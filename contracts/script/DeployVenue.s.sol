// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IStateView} from "@uniswap/v4-periphery/src/interfaces/IStateView.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {Planner, Plan} from "@uniswap/v4-periphery/test/shared/Planner.sol";
import {FixedPointMathLib} from "solady/src/utils/FixedPointMathLib.sol";
import {TestToken} from "../src/tokens/TestToken.sol";
import {RivalOracleHook} from "../src/hook/RivalOracleHook.sol";

/// @notice One-shot Sepolia venue: tWETH, tUSDC, RivalOracleHook, Pool A, Pool B, and liquidity.
contract DeployVenue is Script {
    uint160 internal constant FLAGS = Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG;
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    IPoolManager internal constant POOL_MANAGER = IPoolManager(0xE03A1074c86CFeDd5C142C4F04F1a1536e203543);
    address internal constant POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
    IAllowanceTransfer internal constant PERMIT2 = IAllowanceTransfer(0x000000000022D473030F116dDEE9F6B43aC78BA3);
    /// @dev Sepolia StateView and V4Quoter recorded in PRD.md from the Uniswap v4 deployments.
    address internal constant STATE_VIEW = 0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C;
    address internal constant QUOTER = 0x68aFa8b853cAa7a2D40B0F6AEE5C4DbC147C8244;

    uint256 internal constant ONE_WETH = 1e18;
    uint256 internal constant PRICE_USDC = 3000e6;
    /// @dev Virtual tWETH at the current price. A 1 tWETH swap is then a small fraction of depth.
    uint256 internal constant VIRTUAL_WETH = 20_000 ether;

    error HookAddressMismatch(address predicted, address actual);
    error HookFlagsMismatch(uint160 got);
    error LensMissing(address lens);
    error Range();
    error Depth(uint256 wethAmount);
    error Slot0Mismatch();

    TestToken internal tweth;
    TestToken internal tusdc;
    RivalOracleHook internal hook;
    bytes32 internal salt;
    PoolKey internal poolA;
    PoolKey internal poolB;
    uint160 internal sqrtPrice;
    int24 internal tickA;
    int24 internal tickB;

    function run() external {
        if (STATE_VIEW.code.length == 0) revert LensMissing(STATE_VIEW);
        if (QUOTER.code.length == 0) revert LensMissing(QUOTER);

        (address predicted, bytes32 minedSalt) = HookMiner.find(
            CREATE2_DEPLOYER, FLAGS, type(RivalOracleHook).creationCode, abi.encode(POOL_MANAGER)
        );
        salt = minedSalt;

        vm.startBroadcast();
        _deployTokensAndHook(predicted);
        _initializePools();
        _addLiquidity();
        vm.stopBroadcast();

        _log();
        _checkSlot0(poolA, tickA, 500);
        _checkSlot0(poolB, tickB, 3000);
    }

    function _deployTokensAndHook(address predicted) internal {
        tweth = new TestToken("Test WETH", "tWETH", 18, msg.sender);
        tusdc = new TestToken("Test USDC", "tUSDC", 6, msg.sender);
        hook = new RivalOracleHook{salt: salt}(POOL_MANAGER);
        if (address(hook) != predicted) revert HookAddressMismatch(predicted, address(hook));
        uint160 flags = uint160(address(hook)) & Hooks.ALL_HOOK_MASK;
        if (flags != FLAGS) revert HookFlagsMismatch(flags);
    }

    function _initializePools() internal {
        (Currency currency0, Currency currency1) = _sort(address(tweth), address(tusdc));
        bool wethIs0 = Currency.unwrap(currency0) == address(tweth);
        uint256 raw0 = wethIs0 ? ONE_WETH : PRICE_USDC;
        uint256 raw1 = wethIs0 ? PRICE_USDC : ONE_WETH;
        sqrtPrice = _sqrtPrice(FullMath.mulDiv(raw1, 1 << 192, raw0));
        poolA = PoolKey({currency0: currency0, currency1: currency1, fee: 500, tickSpacing: 10, hooks: IHooks(address(hook))});
        poolB = PoolKey({
            currency0: currency0, currency1: currency1, fee: 3000, tickSpacing: 60, hooks: IHooks(address(0))
        });
        tickA = POOL_MANAGER.initialize(poolA, sqrtPrice);
        tickB = POOL_MANAGER.initialize(poolB, sqrtPrice);
    }

    function _addLiquidity() internal {
        bool wethIs0 = Currency.unwrap(poolA.currency0) == address(tweth);
        uint256 ratioX192 = _ratio(wethIs0);
        (int24 lowerA, int24 upperA) = _range(ratioX192, 10, tickA);
        (int24 lowerB, int24 upperB) = _range(ratioX192, 60, tickB);
        uint128 liquidity = _liquidity(wethIs0);
        uint256 wethA = _wethFor(wethIs0, lowerA, upperA, liquidity);
        uint256 wethB = _wethFor(wethIs0, lowerB, upperB, liquidity);
        if (wethA < 400 ether) revert Depth(wethA);
        if (wethB < 400 ether) revert Depth(wethB);
        _mintTokens(wethIs0, lowerA, upperA, lowerB, upperB, liquidity);
        if (POSITION_MANAGER.code.length == 0) {
            _addWithRouter(lowerA, upperA, lowerB, upperB, liquidity);
        } else {
            _addWithPositionManager(lowerA, upperA, lowerB, upperB, liquidity);
        }
    }

    function _ratio(bool wethIs0) internal pure returns (uint256) {
        uint256 raw0 = wethIs0 ? ONE_WETH : PRICE_USDC;
        uint256 raw1 = wethIs0 ? PRICE_USDC : ONE_WETH;
        return FullMath.mulDiv(raw1, 1 << 192, raw0);
    }

    function _wethFor(bool wethIs0, int24 lower, int24 upper, uint128 liquidity) internal view returns (uint256) {
        (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPrice, TickMath.getSqrtPriceAtTick(lower), TickMath.getSqrtPriceAtTick(upper), liquidity
        );
        return wethIs0 ? amount0 : amount1;
    }

    function _mintTokens(bool wethIs0, int24 lowerA, int24 upperA, int24 lowerB, int24 upperB, uint128 liquidity)
        internal
    {
        (uint256 a0, uint256 a1) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPrice, TickMath.getSqrtPriceAtTick(lowerA), TickMath.getSqrtPriceAtTick(upperA), liquidity
        );
        (uint256 b0, uint256 b1) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPrice, TickMath.getSqrtPriceAtTick(lowerB), TickMath.getSqrtPriceAtTick(upperB), liquidity
        );
        uint256 wethNeed = ((wethIs0 ? a0 + b0 : a1 + b1) * 2) + 1 ether;
        uint256 usdcNeed = ((wethIs0 ? a1 + b1 : a0 + b0) * 2) + 1_000_000;
        tweth.mint(msg.sender, wethNeed);
        tusdc.mint(msg.sender, usdcNeed);
    }

    function _addWithRouter(int24 lowerA, int24 upperA, int24 lowerB, int24 upperB, uint128 liquidity) internal {
        PoolModifyLiquidityTest router = new PoolModifyLiquidityTest(POOL_MANAGER);
        tweth.approve(address(router), type(uint256).max);
        tusdc.approve(address(router), type(uint256).max);
        _modify(router, poolA, lowerA, upperA, liquidity);
        _modify(router, poolB, lowerB, upperB, liquidity);
    }

    function _addWithPositionManager(int24 lowerA, int24 upperA, int24 lowerB, int24 upperB, uint128 liquidity)
        internal
    {
        PERMIT2.approve(address(tweth), POSITION_MANAGER, type(uint160).max, type(uint48).max);
        PERMIT2.approve(address(tusdc), POSITION_MANAGER, type(uint160).max, type(uint48).max);
        _mintPosition(poolA, lowerA, upperA, liquidity);
        _mintPosition(poolB, lowerB, upperB, liquidity);
    }

    function _sort(address a, address b) internal pure returns (Currency currency0, Currency currency1) {
        if (a < b) {
            currency0 = Currency.wrap(a);
            currency1 = Currency.wrap(b);
        } else {
            currency0 = Currency.wrap(b);
            currency1 = Currency.wrap(a);
        }
    }

    function _sqrtPrice(uint256 ratioX192) internal pure returns (uint160 root160) {
        uint256 root = FixedPointMathLib.sqrt(ratioX192);
        if (root < TickMath.MIN_SQRT_PRICE || root > TickMath.MAX_SQRT_PRICE) revert Range();
        root160 = uint160(root);
    }

    /// @dev Ticks covering about 0.4x to 1.6x the initial price, aligned to `spacing`.
    function _range(uint256 ratioX192, int24 spacing, int24 current) internal pure returns (int24 lower, int24 upper) {
        lower = _alignDown(TickMath.getTickAtSqrtPrice(_sqrtPrice(FullMath.mulDiv(ratioX192, 2, 5))), spacing);
        upper = _alignUp(TickMath.getTickAtSqrtPrice(_sqrtPrice(FullMath.mulDiv(ratioX192, 8, 5))), spacing);
        int24 minTick = TickMath.minUsableTick(spacing);
        int24 maxTick = TickMath.maxUsableTick(spacing);
        if (lower < minTick) lower = minTick;
        if (upper > maxTick) upper = maxTick;
        if (lower > current) lower = _alignDown(current, spacing);
        if (upper <= current) upper = _alignUp(current + spacing, spacing);
        if (lower > current || upper <= current || lower >= upper) revert Range();
    }

    function _alignDown(int24 tick, int24 spacing) internal pure returns (int24) {
        int24 compressed = tick / spacing;
        if (tick < 0 && tick % spacing != 0) compressed -= 1;
        return compressed * spacing;
    }

    function _alignUp(int24 tick, int24 spacing) internal pure returns (int24) {
        int24 compressed = tick / spacing;
        if (tick > 0 && tick % spacing != 0) compressed += 1;
        return compressed * spacing;
    }

    function _liquidity(bool wethIs0) internal view returns (uint128) {
        uint256 liquidity;
        if (wethIs0) liquidity = FullMath.mulDiv(VIRTUAL_WETH, sqrtPrice, 1 << 96);
        else liquidity = FullMath.mulDiv(VIRTUAL_WETH, 1 << 96, sqrtPrice);
        liquidity += 1;
        return uint128(liquidity);
    }

    function _modify(PoolModifyLiquidityTest router, PoolKey memory key, int24 lower, int24 upper, uint128 liquidity)
        internal
    {
        router.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: lower, tickUpper: upper, liquidityDelta: int256(uint256(liquidity)), salt: bytes32(0)
            }),
            ""
        );
    }

    function _mintPosition(PoolKey memory key, int24 lower, int24 upper, uint128 liquidity) internal {
        Plan memory plan = Planner.init().add(
            Actions.MINT_POSITION,
            abi.encode(key, lower, upper, uint256(liquidity), type(uint128).max, type(uint128).max, msg.sender, bytes(""))
        );
        IPositionManager(POSITION_MANAGER).modifyLiquidities(
            plan.finalizeModifyLiquidityWithClose(key), block.timestamp + 1 hours
        );
    }

    function _checkSlot0(PoolKey memory key, int24 tick, uint24 fee) internal view {
        (uint160 sqrtSlot, int24 tickSlot,, uint24 lpFee) = IStateView(STATE_VIEW).getSlot0(key.toId());
        if (sqrtSlot != sqrtPrice || tickSlot != tick || lpFee != fee) revert Slot0Mismatch();
        if (IStateView(STATE_VIEW).getLiquidity(key.toId()) == 0) revert Depth(0);
    }

    function _log() internal view {
        console2.log(string.concat("VENUE_TWETH ", vm.toString(address(tweth))));
        console2.log(string.concat("VENUE_TUSDC ", vm.toString(address(tusdc))));
        console2.log(string.concat("VENUE_HOOK ", vm.toString(address(hook))));
        console2.log(string.concat("VENUE_SALT ", vm.toString(salt)));
        console2.log(string.concat("VENUE_POOL_A ", vm.toString(PoolId.unwrap(poolA.toId()))));
        console2.log(string.concat("VENUE_POOL_B ", vm.toString(PoolId.unwrap(poolB.toId()))));
        console2.log(string.concat("VENUE_CURRENCY0 ", vm.toString(Currency.unwrap(poolA.currency0))));
        console2.log(string.concat("VENUE_CURRENCY1 ", vm.toString(Currency.unwrap(poolA.currency1))));
        console2.log(string.concat("VENUE_SQRT ", vm.toString(uint256(sqrtPrice))));
        console2.log(string.concat("VENUE_STATEVIEW ", vm.toString(STATE_VIEW)));
        console2.log(string.concat("VENUE_QUOTER ", vm.toString(QUOTER)));
    }
}
