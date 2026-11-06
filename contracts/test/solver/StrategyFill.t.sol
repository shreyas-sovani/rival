// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {SafeTransferLib} from "solady/src/utils/SafeTransferLib.sol";

import {RivalOracleHook} from "../../src/hook/RivalOracleHook.sol";
import {RivalSettlement} from "../../src/RivalSettlement.sol";
import {UniswapSolver} from "../../src/solver/UniswapSolver.sol";
import {TestToken} from "../../src/tokens/TestToken.sol";
import {FillParams, Gate, Intent, IntentStatus, Mode} from "../../src/Types.sol";
import {LocalPermit2} from "../settlement/LocalPermit2.sol";
import {MockOracle} from "../settlement/MockOracle.sol";
import {MockRegistry} from "../settlement/MockRegistry.sol";

interface IErc20 {
    function balanceOf(address) external view returns (uint256);
    function decimals() external view returns (uint8);
}

/// @notice One successful `RivalSettlement.fill` through `UniswapSolver` at each strategy decision.
/// @dev Local pools run on the in-process EVM. The fork uses the PoolManager and pool A/B from
///      `deployments/sepolia.json` and is skipped when `SEPOLIA_RPC_URL` is unset. Strategy predicates
///      match `packages/solver-sdk/src/strategies.ts`: the curve base is the pool quote, while the
///      absolute intent's on-chain base is sized so the swapped pool can pay `required`.
contract StrategyFill is Test {
    using SafeTransferLib for address;
    using StateLibrary for IPoolManager;

    uint256 internal constant AMOUNT_IN = 0.001 ether;
    uint32 internal constant DECAY = 100;
    int32 internal constant HOUSE_START_BPS = 100;
    int24 internal constant BETTER_OFFSET = 2_000;
    int24 internal constant WIDE_LOWER = -12_000;
    int24 internal constant WIDE_UPPER = 12_000;
    uint256 internal constant WIDE_LIQ = 1e21;
    uint160 internal constant HOOK_FLAGS = Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG;

    /// @dev Canonical Sepolia v4 PoolManager. Pool ids and currencies are copied from deployments/sepolia.json.
    address internal constant SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address internal constant TWETH = 0x45E6a5bD3be4D00E7Be57287D7d25De3F833253d;
    address internal constant TUSDC = 0x571c992873D31310B11Bf6bF6B44f2748B4bce8C;
    address internal constant LIVE_HOOK = 0xb17a547082836fDF87001c1DE031fA8A2D391080;
    bytes32 internal constant POOL_A_ID = 0xd302ad11d027e1897d14162ac1d7a583a7c48a12a547a25c12c9bb1da504f13f;
    bytes32 internal constant POOL_B_ID = 0xc990bf9d3e98afd98afafdad812369a1b8dd6822622f49cf9f7a312701c0549b;

    IPoolManager internal manager;
    PoolModifyLiquidityTest internal liquidityRouter;
    PoolSwapTest internal swapRouter;
    LocalPermit2 internal permit2;
    RivalSettlement internal settlement;

    address internal currency0;
    address internal currency1;
    address internal tokenIn;
    address internal tokenOut;
    PoolKey internal keyA;
    PoolKey internal keyB;
    bool internal forkMode;
    bool internal mintable;
    bool internal arbCreatedPool;
    uint256 internal qA;
    uint256 internal qB;

    address internal maker;
    uint256 internal makerKey;
    address internal recipient;
    uint256 internal nextNonce;

    Intent internal pending;
    bytes internal pendingSig;
    Intent internal patientIntent;
    bytes internal patientSig;
    string[] internal filled;

    receive() external payable {}

    function test_local_eachStrategyFills() public {
        forkMode = false;
        mintable = true;
        vm.warp(1_700_000_000);
        _bootLocal();
        _run();
    }

    function test_fork_eachStrategyFills() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true, "SEPOLIA_RPC_URL is unset; Sepolia fork skipped");
            return;
        }

        vm.createSelectFork("sepolia");
        forkMode = true;
        mintable = false;
        _bootFork();
        _run();
    }

    function _run() internal {
        _armPatient();
        _fillSprint();
        _fillPatient();
        _fillHouse();
        _fillArb();
        _fillInventory();

        assertEq(filled.length, 5);
        assertEq(filled[0], "sprint");
        assertEq(filled[1], "patient");
        assertEq(filled[2], "house");
        assertEq(filled[3], "arb");
        assertEq(filled[4], "inventory");
    }

    function _bootLocal() internal {
        manager = new PoolManager(address(this));
        _routers();
        (address predicted, bytes32 salt) =
            HookMiner.find(address(this), HOOK_FLAGS, type(RivalOracleHook).creationCode, abi.encode(manager));
        RivalOracleHook hook = new RivalOracleHook{salt: salt}(manager);
        assertEq(address(hook), predicted);

        TestToken a = new TestToken("TokenA", "TA", 18, address(this));
        TestToken b = new TestToken("TokenB", "TB", 18, address(this));
        if (address(a) > address(b)) (a, b) = (b, a);
        currency0 = address(a);
        currency1 = address(b);
        tokenIn = currency0;
        tokenOut = currency1;
        a.mint(address(this), 1_000_000 ether);
        b.mint(address(this), 1_000_000 ether);
        _approveRouters();

        keyA = _key(500, 10, IHooks(address(hook)));
        keyB = _key(3000, 60, IHooks(address(0)));
        _initWide(keyA, TickMath.getSqrtPriceAtTick(0));
        _initWide(keyB, TickMath.getSqrtPriceAtTick(0));
        _installSettlement();
    }

    function _bootFork() internal {
        manager = IPoolManager(SEPOLIA_POOL_MANAGER);
        assertGt(address(manager).code.length, 0, "canonical PoolManager has no code");
        _routers();

        currency0 = TWETH;
        currency1 = TUSDC;
        tokenIn = currency0;
        tokenOut = currency1;
        assertLt(uint256(uint160(currency0)), uint256(uint160(currency1)), "currency order");
        assertEq(IErc20(tokenIn).decimals(), 18);

        keyA = _key(500, 10, IHooks(LIVE_HOOK));
        keyB = _key(3000, 60, IHooks(address(0)));
        assertEq(PoolId.unwrap(keyA.toId()), POOL_A_ID, "pool A");
        assertEq(PoolId.unwrap(keyB.toId()), POOL_B_ID, "pool B");
        (uint160 sqrtA,,,) = manager.getSlot0(keyA.toId());
        (uint160 sqrtB,,,) = manager.getSlot0(keyB.toId());
        assertGt(sqrtA, 0, "pool A has no price");
        assertGt(sqrtB, 0, "pool B has no price");

        uint256 unit1 = 10 ** uint256(IErc20(currency1).decimals());
        _setBalance(currency0, address(this), 50 ether);
        _setBalance(currency1, address(this), 200_000 * unit1);
        _approveRouters();
        _installSettlement();
    }

    function _routers() internal {
        liquidityRouter = new PoolModifyLiquidityTest(manager);
        swapRouter = new PoolSwapTest(manager);
    }

    function _key(uint24 fee, int24 spacing, IHooks hooks) internal view returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(currency0),
            currency1: Currency.wrap(currency1),
            fee: fee,
            tickSpacing: spacing,
            hooks: hooks
        });
    }

    function _approveRouters() internal {
        currency0.safeApprove(address(liquidityRouter), type(uint256).max);
        currency1.safeApprove(address(liquidityRouter), type(uint256).max);
        currency0.safeApprove(address(swapRouter), type(uint256).max);
        currency1.safeApprove(address(swapRouter), type(uint256).max);
    }

    function _initWide(PoolKey memory key, uint160 sqrtPrice) internal {
        manager.initialize(key, sqrtPrice);
        liquidityRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: WIDE_LOWER, tickUpper: WIDE_UPPER, liquidityDelta: int256(WIDE_LIQ), salt: 0
            }),
            ""
        );
    }

    function _installSettlement() internal {
        permit2 = new LocalPermit2();
        settlement = new RivalSettlement(
            permit2, new MockOracle(), new MockRegistry(), RivalSettlement.PairConfig({key: keyA})
        );
        makerKey = 0xA11CE;
        maker = vm.addr(makerKey);
        while (maker.code.length != 0) {
            makerKey = uint256(keccak256(abi.encode(makerKey)));
            maker = vm.addr(makerKey);
        }
        recipient = makeAddr("strategy-fill-recipient");
        nextNonce = 1;
        _topUp(tokenIn, maker, 10 ether);
        vm.startPrank(maker);
        tokenIn.safeApprove(address(permit2), type(uint256).max);
        vm.stopPrank();
    }

    function _armPatient() internal {
        uint256 quote = _quote(keyA);
        _prepare(0, quote);
        assertEq(block.timestamp, uint256(pending.startTime), "patient armed at elapsed 0");

        (bool waiting, string memory waitingReason) = _patient(0, quote);
        assertFalse(waiting);
        assertEq(waitingReason, "waiting");

        (bool early, string memory earlyReason) = _patient(uint256(DECAY) / 2 - 1, quote);
        assertFalse(early);
        assertEq(earlyReason, "waiting");

        (bool halfway, string memory halfwayReason) = _patient(uint256(DECAY) / 2, quote);
        assertTrue(halfway, halfwayReason);
        assertEq(halfwayReason, "halfway");

        patientIntent = pending;
        patientSig = pendingSig;
    }

    function _fillSprint() internal {
        uint256 quote = _quote(keyA);
        _prepare(0, quote);
        assertEq(block.timestamp, uint256(pending.startTime), "sprint elapsed 0");
        (bool yes, string memory reason) = _sprint(0, quote);
        assertTrue(yes, reason);
        assertEq(reason, "covers required");
        _fill(_solver(), keyA);
        _mark("sprint");
    }

    function _fillPatient() internal {
        vm.warp(uint256(patientIntent.startTime) + uint256(DECAY) / 2);
        pending = patientIntent;
        pendingSig = patientSig;
        uint256 quote = _quote(keyA);
        uint256 elapsed = block.timestamp - uint256(pending.startTime);
        assertGe(elapsed, uint256(DECAY) / 2, "patient before halfway");
        (bool yes, string memory reason) = _patient(elapsed, quote);
        assertTrue(yes, reason);
        assertEq(reason, "halfway");

        (uint256 required,,) = settlement.requiredAt(pending, block.timestamp);
        assertLe(required, quote, "patient pool cannot pay");
        _fill(_solver(), keyA);
        _mark("patient");
    }

    /// @dev High start bps puts the strategy curve above the quote, so sprint, patient, and inventory decline.
    ///      Pool B does not clear cost. The quote still clears `hardMinOut`, so house fills through pool A.
    function _fillHouse() internal {
        UniswapSolver solver = _solver();
        qA = _quote(keyA);
        qB = _quote(keyB);
        _prepare(HOUSE_START_BPS, qA);
        assertEq(block.timestamp, uint256(pending.startTime), "house elapsed");
        assertGe(qA, uint256(pending.hardMinOut), "quote below hard floor");
        _assertHouseDeclines(solver);
        (bool yes, string memory reason) = _house(qA, false);
        assertTrue(yes, reason);
        assertEq(reason, "house fills");
        _fill(solver, keyA);
        _mark("house");
    }

    function _assertHouseDeclines(UniswapSolver solver) internal view {
        (bool sprintYes, string memory sprintReason) = _sprint(0, qA);
        assertFalse(sprintYes);
        assertEq(sprintReason, "below required");
        _assertPatientAndArbDecline();
        _assertInventoryDeclines(_bal(tokenOut, address(solver)));
    }

    function _assertPatientAndArbDecline() internal view {
        (bool patientYes, string memory patientReason) = _patient(0, qA);
        assertFalse(patientYes);
        assertEq(patientReason, "below required");
        (bool arbYes, string memory arbReason) = _arb(qA, qB, _cost(qA));
        assertFalse(arbYes);
        assertEq(arbReason, "gap within cost");
    }

    function _assertInventoryDeclines(uint256 balance) internal view {
        uint256 need = _curveRequired(0, qA);
        (bool inventoryYes, string memory inventoryReason) = _inventory(0, qA, true, balance);
        assertFalse(inventoryYes);
        assertEq(inventoryReason, "insufficient inventory");
        assertLt(balance, need, "house solver already holds required");
    }

    function _fillArb() internal {
        qA = _quote(keyA);
        qB = _quote(keyB);
        (bool liveBeats, string memory liveReason) = _arb(qA, qB, _cost(qA));
        if (liveBeats) {
            assertEq(liveReason, "venue covers cost");
            _prepare(0, qB);
            _fill(_solver(), keyB);
        } else {
            _fillArbOnBetterPool(liveReason);
        }
        if (!forkMode) assertTrue(arbCreatedPool, "local pool B was not the worse venue");
        _mark("arb");
    }

    function _fillArbOnBetterPool(string memory liveReason) internal {
        assertEq(liveReason, "gap within cost");
        (, int24 tickA,,) = manager.getSlot0(keyA.toId());
        PoolKey memory pool = _createBetter(tickA);
        uint256 quoteFill = _quote(pool);
        (bool yes, string memory reason) = _arb(qA, quoteFill, _cost(qA));
        assertTrue(yes, reason);
        assertEq(reason, "venue covers cost");
        arbCreatedPool = true;
        _prepare(0, quoteFill);
        _fill(_solver(), pool);
    }

    function _fillInventory() internal {
        uint256 quote = _quote(keyA);
        _prepare(0, quote);
        uint256 need = _curveRequired(0, quote);
        UniswapSolver solver = _solver();
        assertEq(_bal(tokenOut, address(solver)), 0);

        (bool short,) = _inventory(0, quote, true, need - 1);
        assertFalse(short, "inventory filled without enough balance");

        _topUp(tokenOut, address(solver), need);
        (bool yes, string memory reason) = _inventory(0, quote, true, _bal(tokenOut, address(solver)));
        assertTrue(yes, reason);
        assertEq(reason, "balance covers required");

        _fill(solver, keyA);
        _mark("inventory");
    }

    function _createBetter(int24 tickA) internal returns (PoolKey memory key) {
        int24 target = tickA + BETTER_OFFSET;
        assertLt(int256(target), int256(TickMath.maxUsableTick(10)), "better tick out of range");
        key = _key(100, 10, IHooks(address(0)));
        if (!forkMode) {
            assertGt(int256(target), int256(WIDE_LOWER));
            assertLt(int256(target), int256(WIDE_UPPER));
            _initWide(key, TickMath.getSqrtPriceAtTick(target));
            return key;
        }
        _initBudgeted(key, target);
    }

    function _initBudgeted(PoolKey memory key, int24 target) internal {
        int24 spacing = key.tickSpacing;
        int24 width = spacing * 200;
        int24 lower = _alignDown(target - width, spacing);
        int24 upper = _alignDown(target + width, spacing);
        int24 minTick = TickMath.minUsableTick(spacing);
        int24 maxTick = TickMath.maxUsableTick(spacing);
        if (lower < minTick) lower = minTick;
        if (upper > maxTick) upper = maxTick;
        if (lower >= target) lower = _alignDown(target, spacing) - spacing;
        if (upper <= target) upper = _alignDown(target, spacing) + spacing;
        if (lower < minTick) lower = minTick;
        if (upper > maxTick) upper = maxTick;
        assertLt(int256(lower), int256(target), "better range lower");
        assertGt(int256(upper), int256(target), "better range upper");

        uint160 sqrtP = TickMath.getSqrtPriceAtTick(target);
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtP,
            TickMath.getSqrtPriceAtTick(lower),
            TickMath.getSqrtPriceAtTick(upper),
            _bal(currency0, address(this)) / 4,
            _bal(currency1, address(this)) / 4
        );
        assertGt(liquidity, 0, "better pool liquidity");
        manager.initialize(key, sqrtP);
        liquidityRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: lower, tickUpper: upper, liquidityDelta: int256(uint256(liquidity)), salt: 0}),
            ""
        );
    }

    function _prepare(int32 startBps, uint256 quote) internal {
        pending.maker = maker;
        pending.tokenIn = tokenIn;
        pending.tokenOut = tokenOut;
        pending.amountIn = uint128(AMOUNT_IN);
        pending.recipient = recipient;
        pending.mode = Mode.ABSOLUTE;
        pending.oracleWindow = 0;
        pending.floorBps = 0;
        pending.startTime = uint32(block.timestamp);
        pending.decaySecs = DECAY;
        pending.deadline = pending.startTime + 3_600;
        pending.gate = Gate.OPEN;
        pending.allowlistHash = bytes32(0);
        pending.nonce = nextNonce++;
        _size(startBps, quote);
        pendingSig = _sign(pending);
    }

    function _size(int32 startBps, uint256 quote) internal {
        uint256 base = quote * 10_000 / (10_000 + uint256(int256(startBps)));
        if (base > 1) base = base * 99 / 100;
        if (base == 0) base = 1;
        pending.startBps = startBps;
        pending.baseOut = uint128(base);
        pending.hardMinOut = uint128(base);
        (uint256 required,,) = settlement.requiredAt(pending, block.timestamp);
        uint256 spins;
        while (required > quote && base > 1 && spins < 6) {
            base = base * 99 / 100;
            if (base == 0) base = 1;
            pending.baseOut = uint128(base);
            pending.hardMinOut = uint128(base);
            (required,,) = settlement.requiredAt(pending, block.timestamp);
            unchecked {
                spins++;
            }
        }
        assertLe(required, quote, "required above quote");
    }

    function _fill(UniswapSolver solver, PoolKey memory key) internal {
        _topUp(tokenIn, maker, pending.amountIn);
        (uint256 required,,) = settlement.requiredAt(pending, block.timestamp);
        uint256 recipientBefore = _bal(tokenOut, recipient);
        uint256 makerBefore = _bal(tokenIn, maker);

        vm.prank(address(solver));
        settlement.fill(
            pending,
            pendingSig,
            FillParams({
                inputTo: address(solver), useCallback: true, data: abi.encode(key), allowLabels: new bytes32[](0)
            })
        );

        assertEq(_bal(tokenOut, recipient) - recipientBefore, required, "recipient short");
        assertGe(required, uint256(pending.hardMinOut));
        assertEq(makerBefore - _bal(tokenIn, maker), uint256(pending.amountIn), "maker pull");
        assertEq(_bal(tokenIn, address(solver)), 0, "solver kept tokenIn");
        assertEq(settlement.status(settlement.intentHash(pending)), uint8(IntentStatus.FILLED));
    }

    function _solver() internal returns (UniswapSolver) {
        return new UniswapSolver(address(settlement), manager, address(this));
    }

    function _quote(PoolKey memory key) internal returns (uint256 out) {
        _topUp(tokenIn, address(this), AMOUNT_IN);
        uint256 snap = vm.snapshotState();
        BalanceDelta delta = swapRouter.swap(
            key,
            SwapParams({
                zeroForOne: true, amountSpecified: -int256(AMOUNT_IN), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
        int128 raw = delta.amount1();
        assertTrue(vm.revertToStateAndDelete(snap), "quote snapshot");
        assertGt(int256(raw), int256(0), "quote");
        out = uint256(uint128(raw));
    }

    function _mark(string memory name) internal {
        filled.push(name);
        emit log_string(string.concat("filled ", name));
    }

    function _sprint(uint256 elapsed, uint256 quote) internal view returns (bool, string memory) {
        uint256 required = _curveRequired(elapsed, quote);
        if (quote >= required) return (true, "covers required");
        return (false, "below required");
    }

    function _patient(uint256 elapsed, uint256 quote) internal view returns (bool, string memory) {
        uint256 required = _curveRequired(elapsed, quote);
        if (quote < required) return (false, "below required");
        if (elapsed > uint256(DECAY)) elapsed = uint256(DECAY);
        if (elapsed * 2 >= uint256(DECAY)) return (true, "halfway");
        if (_clearsFloor(quote)) return (true, "clears floor");
        return (false, "waiting");
    }

    function _arb(uint256 quote, uint256 other, uint256 cost) internal pure returns (bool, string memory) {
        if (other > quote && other - quote > cost) return (true, "venue covers cost");
        return (false, "gap within cost");
    }

    function _inventory(uint256 elapsed, uint256 quote, bool hasBalance, uint256 balance)
        internal
        view
        returns (bool, string memory)
    {
        if (!hasBalance) return (false, "bad params");
        uint256 required = _curveRequired(elapsed, quote);
        if (balance >= required) return (true, "balance covers required");
        return (false, "insufficient inventory");
    }

    function _house(uint256 quote, bool othersPassing) internal view returns (bool, string memory) {
        if (quote < uint256(pending.hardMinOut)) return (false, "below hard minimum");
        if (othersPassing) return (false, "others passing");
        return (true, "house fills");
    }

    function _curveRequired(uint256 elapsed, uint256 quote) internal view returns (uint256) {
        return _required(
            elapsed, uint256(pending.decaySecs), pending.startBps, pending.floorBps, quote, uint256(pending.hardMinOut)
        );
    }

    function _clearsFloor(uint256 quote) internal view returns (bool) {
        uint256 curveOut =
            _ceilDiv(quote * uint256(int256(10_000) + int256(pending.floorBps)), 10_000);
        uint256 floor = curveOut > uint256(pending.hardMinOut) ? curveOut : uint256(pending.hardMinOut);
        return quote * 10_000 >= floor * 10_010;
    }

    function _required(
        uint256 elapsed,
        uint256 decay,
        int256 startBps,
        int256 floorBps,
        uint256 quote,
        uint256 hardMin
    ) internal pure returns (uint256) {
        if (elapsed > decay) elapsed = decay;
        int256 decayed = _floorDiv((startBps - floorBps) * int256(elapsed), int256(decay));
        int256 bps = startBps - decayed;
        uint256 curveOut = _ceilDiv(quote * uint256(int256(10_000) + bps), 10_000);
        return curveOut > hardMin ? curveOut : hardMin;
    }

    function _floorDiv(int256 n, int256 d) internal pure returns (int256 q) {
        q = n / d;
        if (n % d != 0 && (n < 0) != (d < 0)) q -= 1;
    }

    function _ceilDiv(uint256 n, uint256 d) internal pure returns (uint256) {
        if (n == 0) return 0;
        return (n - 1) / d + 1;
    }

    function _cost(uint256 quote) internal pure returns (uint256 cost) {
        cost = quote / 100;
        if (cost == 0) cost = 1;
    }

    function _alignDown(int24 tick, int24 spacing) internal pure returns (int24) {
        int24 compressed = tick / spacing;
        if (tick < 0 && tick % spacing != 0) compressed--;
        return compressed * spacing;
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

    function _topUp(address token, address to, uint256 amount) internal {
        if (_bal(token, to) >= amount) return;
        if (mintable) TestToken(token).mint(to, amount - _bal(token, to));
        else _setBalance(token, to, amount);
    }

    function _setBalance(address token, address to, uint256 amount) internal {
        deal(token, to, amount);
        assertEq(_bal(token, to), amount, "token balance write");
    }

    function _bal(address token, address who) internal view returns (uint256) {
        return IErc20(token).balanceOf(who);
    }
}
