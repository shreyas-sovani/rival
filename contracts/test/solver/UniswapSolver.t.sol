// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {RivalOracleHook} from "../../src/hook/RivalOracleHook.sol";
import {RivalSettlement} from "../../src/RivalSettlement.sol";
import {UniswapSolver} from "../../src/solver/UniswapSolver.sol";
import {TestToken} from "../../src/tokens/TestToken.sol";
import {FillParams, Gate, Intent, Mode, Unauthorized} from "../../src/Types.sol";
import {LocalPermit2} from "../settlement/LocalPermit2.sol";
import {MockOracle} from "../settlement/MockOracle.sol";
import {MockRegistry} from "../settlement/MockRegistry.sol";

/// @notice Shared pool, settlement, and fill setup for the reference solver.
abstract contract SolverFixture is Test {
    uint256 internal constant MAKER_KEY = 0xA11CE;
    uint256 internal constant AMOUNT_IN = 0.001 ether;
    uint256 internal constant BASE_OUT = 0.0009 ether;
    uint256 internal constant LIQUIDITY = 1e21;
    uint160 internal constant FLAGS = Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG;
    int24 internal constant TICK_LOWER = -12_000;
    int24 internal constant TICK_UPPER = 12_000;
    uint32 internal constant T0 = 1_700_000_000;

    IPoolManager internal manager;
    RivalOracleHook internal hook;
    PoolModifyLiquidityTest internal liquidityRouter;
    TestToken internal token0;
    TestToken internal token1;
    LocalPermit2 internal permit2;
    MockOracle internal oracle;
    MockRegistry internal registry;
    RivalSettlement internal settlement;
    UniswapSolver internal solver;
    PoolKey internal keyHooked;
    PoolKey internal keyVanilla;

    address internal maker;
    uint256 internal makerKey;
    address internal recipient;
    uint256 internal nextNonce;

    receive() external payable {}

    function _deploy(IPoolManager poolManager) internal {
        vm.warp(T0);
        manager = poolManager;
        makerKey = MAKER_KEY;
        maker = vm.addr(makerKey);
        // Sepolia may already have code at a low test key. Permit2 then uses EIP-1271.
        while (maker.code.length != 0) {
            makerKey = uint256(keccak256(abi.encode(makerKey)));
            maker = vm.addr(makerKey);
        }
        recipient = makeAddr("recipient");
        nextNonce = 1;

        liquidityRouter = new PoolModifyLiquidityTest(manager);
        (address predicted, bytes32 salt) =
            HookMiner.find(address(this), FLAGS, type(RivalOracleHook).creationCode, abi.encode(manager));
        hook = new RivalOracleHook{salt: salt}(manager);
        assertEq(address(hook), predicted);

        TestToken a = new TestToken("TokenA", "TA", 18, address(this));
        TestToken b = new TestToken("TokenB", "TB", 18, address(this));
        if (address(a) < address(b)) {
            token0 = a;
            token1 = b;
        } else {
            token0 = b;
            token1 = a;
        }
        token0.mint(address(this), 1_000_000 ether);
        token1.mint(address(this), 1_000_000 ether);
        token0.approve(address(liquidityRouter), type(uint256).max);
        token1.approve(address(liquidityRouter), type(uint256).max);

        keyHooked = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 500,
            tickSpacing: 10,
            hooks: IHooks(address(hook))
        });
        keyVanilla = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        assertEq(uint256(keyHooked.fee), 500);
        assertEq(int256(keyHooked.tickSpacing), 10);
        assertEq(address(keyHooked.hooks), address(hook));
        assertEq(uint256(keyVanilla.fee), 3000);
        assertEq(int256(keyVanilla.tickSpacing), 60);
        assertEq(address(keyVanilla.hooks), address(0));

        _seed(keyHooked);
        _seed(keyVanilla);

        permit2 = new LocalPermit2();
        oracle = new MockOracle();
        registry = new MockRegistry();
        settlement = new RivalSettlement(
            permit2,
            oracle,
            registry,
            RivalSettlement.PairConfig({key: keyHooked})
        );
        solver = new UniswapSolver(address(settlement), manager, address(this));

        token0.mint(maker, 100 ether);
        vm.prank(maker);
        token0.approve(address(permit2), type(uint256).max);
    }

    function _seed(PoolKey memory key) internal {
        int24 opened = manager.initialize(key, TickMath.getSqrtPriceAtTick(0));
        assertEq(opened, 0);
        liquidityRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: TICK_LOWER, tickUpper: TICK_UPPER, liquidityDelta: int256(LIQUIDITY), salt: 0
            }),
            ""
        );
    }

    /// @dev Signs before `prank`. `prank` applies to the next external call, and signing calls the settlement.
    function _fill(PoolKey memory key) internal returns (uint256 required) {
        Intent memory i = _intent(nextNonce++);
        (required,,) = settlement.requiredAt(i, block.timestamp);
        assertEq(required, BASE_OUT);

        bytes memory sig = _sign(i);
        FillParams memory p = FillParams({
            inputTo: address(solver),
            useCallback: true,
            data: abi.encode(key),
            allowLabels: new bytes32[](0)
        });

        uint256 makerBefore = token0.balanceOf(maker);
        uint256 recipientBefore = token1.balanceOf(recipient);
        uint256 solverOutBefore = token1.balanceOf(address(solver));

        vm.prank(address(solver));
        settlement.fill(i, sig, p);

        assertEq(makerBefore - token0.balanceOf(maker), AMOUNT_IN);
        assertEq(token1.balanceOf(recipient) - recipientBefore, required);
        assertGe(token1.balanceOf(recipient) - recipientBefore, i.hardMinOut);
        assertEq(token0.balanceOf(address(solver)), 0);
        assertGt(token1.balanceOf(address(solver)), solverOutBefore);
        assertEq(token1.allowance(address(solver), address(settlement)), 0);
        assertEq(token0.balanceOf(address(settlement)), 0);
        assertEq(token1.balanceOf(address(settlement)), 0);
    }

    function _intent(uint256 nonce) internal view returns (Intent memory i) {
        i.maker = maker;
        i.tokenIn = address(token0);
        i.tokenOut = address(token1);
        i.amountIn = uint128(AMOUNT_IN);
        i.recipient = recipient;
        i.mode = Mode.ABSOLUTE;
        i.baseOut = uint128(BASE_OUT);
        i.oracleWindow = 0;
        i.startBps = 0;
        i.floorBps = 0;
        i.startTime = T0;
        i.decaySecs = 90;
        i.deadline = T0 + 3_600;
        i.hardMinOut = uint128(BASE_OUT);
        i.gate = Gate.OPEN;
        i.nonce = nonce;
    }

    function _sign(Intent memory i) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(makerKey, _permitDigest(i));
        return abi.encodePacked(r, s, v);
    }

    function _permitDigest(Intent memory i) internal view returns (bytes32) {
        bytes32 witness = settlement.intentHash(i);
        bytes32 typeHash = keccak256(
            abi.encodePacked(
                "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,",
                settlement.WITNESS_TYPE_STRING()
            )
        );
        bytes32 tokenHash = keccak256(
            abi.encode(keccak256("TokenPermissions(address token,uint256 amount)"), i.tokenIn, uint256(i.amountIn))
        );
        bytes32 structHash =
            keccak256(abi.encode(typeHash, tokenHash, address(settlement), i.nonce, uint256(i.deadline), witness));
        return keccak256(abi.encodePacked(hex"1901", permit2.DOMAIN_SEPARATOR(), structHash));
    }
}

contract UniswapSolverTest is SolverFixture {
    function setUp() public {
        _deploy(new PoolManager(address(this)));
    }

    function test_rivalFillCallback_revertsUnlessSettlement() public {
        vm.expectRevert(Unauthorized.selector);
        solver.rivalFillCallback(bytes32(0), address(token0), address(token1), 1, 1, "");

        vm.expectRevert(Unauthorized.selector);
        vm.prank(makeAddr("stranger"));
        solver.rivalFillCallback(bytes32(0), address(token0), address(token1), 1, 1, abi.encode(keyHooked));
    }

    function test_fill_hookedPool_recipientReceivesRequired() public {
        uint256 before = token1.balanceOf(recipient);
        uint256 required = _fill(keyHooked);
        assertEq(token1.balanceOf(recipient) - before, required);
    }

    function test_fill_vanillaPool_recipientReceivesRequired() public {
        uint256 before = token1.balanceOf(recipient);
        uint256 required = _fill(keyVanilla);
        assertEq(token1.balanceOf(recipient) - before, required);
    }

    function test_ownerSweep_sendsLeftover_nonOwnerReverts() public {
        _fill(keyHooked);
        uint256 leftover = token1.balanceOf(address(solver));
        assertGt(leftover, 0);

        address treasury = makeAddr("treasury");
        vm.expectRevert(Unauthorized.selector);
        vm.prank(makeAddr("stranger"));
        solver.sweep(address(token1), treasury);
        assertEq(token1.balanceOf(address(solver)), leftover);
        assertEq(token1.balanceOf(treasury), 0);

        solver.sweep(address(token1), treasury);
        assertEq(token1.balanceOf(treasury), leftover);
        assertEq(token1.balanceOf(address(solver)), 0);
    }
}

/// @notice Same fill path against the canonical Sepolia PoolManager. Pools are created in the test.
contract UniswapSolverForkTest is SolverFixture {
    address internal constant SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;

    function test_fork_fillBothPools() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true, "SEPOLIA_RPC_URL is unset; Sepolia fork skipped");
            return;
        }

        vm.createSelectFork("sepolia");
        _deploy(IPoolManager(SEPOLIA_POOL_MANAGER));
        assertGt(address(manager).code.length, 0, "canonical PoolManager has no code");

        _fill(keyHooked);
        _fill(keyVanilla);
    }
}
