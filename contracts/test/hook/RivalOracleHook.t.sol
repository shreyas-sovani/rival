// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {TestToken} from "../../src/tokens/TestToken.sol";
import {RivalOracleHook} from "../../src/hook/RivalOracleHook.sol";
import {InsufficientHistory, WindowOutOfRange} from "../../src/Types.sol";

contract RivalOracleHookTest is Test {
    using StateLibrary for IPoolManager;

    uint256 internal constant FUND = 1_000_000 ether;
    uint160 internal constant FLAGS = Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG;

    IPoolManager internal manager;
    RivalOracleHook internal hook;
    PoolSwapTest internal swapRouter;
    PoolModifyLiquidityTest internal liquidityRouter;
    TestToken internal token0;
    TestToken internal token1;

    PoolKey internal key;
    PoolKey internal zeroKey;
    PoolKey internal oracleKey;
    uint24 internal goldenFee = 9000;

    function setUp() public {
        manager = new PoolManager(address(this));
        swapRouter = new PoolSwapTest(manager);
        liquidityRouter = new PoolModifyLiquidityTest(manager);
        hook = _mineHook(manager);

        TestToken a = new TestToken("TokenA", "TA", 18, address(this));
        TestToken b = new TestToken("TokenB", "TB", 18, address(this));
        if (address(a) < address(b)) {
            token0 = a;
            token1 = b;
        } else {
            token0 = b;
            token1 = a;
        }
        token0.mint(address(this), FUND);
        token1.mint(address(this), FUND);
        token0.approve(address(swapRouter), type(uint256).max);
        token1.approve(address(swapRouter), type(uint256).max);
        token0.approve(address(liquidityRouter), type(uint256).max);
        token1.approve(address(liquidityRouter), type(uint256).max);

        vm.warp(1_000_000);
        key = _poolKey(3000);
        zeroKey = _poolKey(100);
        oracleKey = _poolKey(200);
        manager.initialize(key, TickMath.getSqrtPriceAtTick(0));
        manager.initialize(zeroKey, TickMath.getSqrtPriceAtTick(0));
        manager.initialize(oracleKey, TickMath.getSqrtPriceAtTick(0));
        _modify(key, 1e18);
    }

    function test_permissionsBitmap() public view {
        Hooks.Permissions memory p = hook.getHookPermissions();
        assertTrue(p.afterInitialize);
        assertTrue(p.beforeSwap);
        assertFalse(p.beforeInitialize);
        assertFalse(p.beforeAddLiquidity);
        assertFalse(p.afterAddLiquidity);
        assertFalse(p.beforeRemoveLiquidity);
        assertFalse(p.afterRemoveLiquidity);
        assertFalse(p.afterSwap);
        assertFalse(p.beforeDonate);
        assertFalse(p.afterDonate);
        assertFalse(p.beforeSwapReturnDelta);
        assertFalse(p.afterSwapReturnDelta);
        assertFalse(p.afterAddLiquidityReturnDelta);
        assertFalse(p.afterRemoveLiquidityReturnDelta);

        uint160 flags = uint160(address(hook)) & Hooks.ALL_HOOK_MASK;
        assertEq(flags, FLAGS);
        assertTrue(Hooks.isValidHookAddress(IHooks(address(hook)), 500));
        assertTrue(Hooks.isValidHookAddress(IHooks(address(hook)), 3000));
        Hooks.validateHookPermissions(IHooks(address(hook)), p);
    }

    function test_oneObservationPerBlock() public {
        vm.warp(block.timestamp + 40);
        PoolId id = key.toId();
        (, uint16 beforeCard) = hook.ringState(id);
        for (uint256 i = 0; i < 100; i++) {
            _swap(key, -1e6, true, TickMath.MIN_SQRT_PRICE + 1);
        }
        (uint16 afterIndex, uint16 afterCard) = hook.ringState(id);
        assertEq(afterCard, beforeCard + 1);
        (uint32 ts,,) = hook.observation(id, afterIndex);
        assertEq(ts, uint32(block.timestamp));
    }

    function test_sameBlockManipulationZero() public {
        vm.warp(block.timestamp + 100);
        int24 moved = _swapToward(960);
        assertGt(moved, 900);
        assertLt(moved, 1100);

        vm.warp(block.timestamp + 100);
        int24 beforeConsult = hook.consult(key, 60);
        assertGt(beforeConsult, 100);

        int24 again = _swapToward(1920);
        int24 afterConsult = hook.consult(key, 60);
        assertGt(again - moved, 900);
        assertEq(beforeConsult, afterConsult);
    }

    function test_manipulationBounded() public {
        uint32 window = 3600;
        uint256 k = 50;
        uint256 step = 12;
        uint256 duration = k * step;

        vm.warp(block.timestamp + window);
        int24 beforeAvg = hook.consult(key, window);
        assertEq(beforeAvg, 0);

        int24 moved = _swapToward(960);
        int256 delta = int256(moved);
        assertGt(delta, 900);
        assertLt(delta, 1100);

        for (uint256 i = 0; i < k; i++) {
            vm.warp(block.timestamp + step);
            vm.roll(block.number + 1);
        }

        int24 afterAvg = hook.consult(key, window);
        int256 shift = int256(afterAvg) - int256(beforeAvg);
        int256 predicted = (delta * int256(duration)) / int256(uint256(window));
        assertLe(shift, predicted + 1);
        assertGe(shift, predicted - 1);
    }

    function test_beforeSwapNeverReverts(uint256 tickSeed, uint32 timeBump, bool zeroForOne, int128 amountRaw) public {
        BalanceDelta delta = _swap(key, -1e15, true, TickMath.MIN_SQRT_PRICE + 1);
        assertLt(delta.amount0(), 0);

        try swapRouter.swap(
            zeroKey,
            SwapParams({
                zeroForOne: true,
                amountSpecified: -1e15,
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        ) returns (BalanceDelta) {} catch (bytes memory reason) {
            assertFalse(_containsSelector(reason, Hooks.HookCallFailed.selector));
        }

        int256 span = int256(TickMath.MAX_TICK) * 2;
        int24 tick = int24(int256(bound(tickSeed, 0, uint256(span))) - int256(TickMath.MAX_TICK));
        int24[3] memory extremes = [TickMath.MIN_TICK, tick, TickMath.MAX_TICK];
        uint256 bump = bound(uint256(timeBump), 0, 3 days);
        if (bump > 0) vm.warp(block.timestamp + bump);

        int256 amount = amountRaw == 0 ? int256(-1) : int256(amountRaw);
        uint160 limit = zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        for (uint256 i = 0; i < extremes.length; i++) {
            _writeTick(oracleKey.toId(), extremes[i]);
            vm.expectRevert();
            hook.beforeSwap(
                address(this),
                oracleKey,
                SwapParams({zeroForOne: zeroForOne, amountSpecified: amount, sqrtPriceLimitX96: limit}),
                ""
            );
            (bytes4 sel, BeforeSwapDelta hookDelta, uint24 fee) = _callBeforeSwap(oracleKey, zeroForOne, amount, limit);
            assertEq(sel, IHooks.beforeSwap.selector);
            assertEq(BeforeSwapDelta.unwrap(hookDelta), 0);
            assertEq(fee, 0);
        }
    }

    function test_liquidityIgnored() public {
        vm.warp(block.timestamp + 120);
        int24 before = hook.consult(key, 60);
        _modify(key, 1e18);
        assertEq(hook.consult(key, 60), before);
        _modify(key, -2e18);
        assertEq(hook.consult(key, 60), before);
    }

    function test_quoteMonotonic() public {
        vm.warp(block.timestamp + 30);
        _swapToward(960);
        vm.warp(block.timestamp + 120);
        _assertMonotonic(true);
        _assertMonotonic(false);
    }

    function test_quoteGolden() public {
        _assertGolden(0, 0, true, 0);
        _assertGolden(0, 1, true, 1);
        _assertGolden(0, 1e18, false, 1e18);
        _assertGolden(1, 1_000_000, true, 1_000_100);
        _assertGolden(1, 1_000_000, false, 999_900);
        _assertGolden(-1, 1_000_000, true, 999_900);
        _assertGolden(-1, 1_000_000, false, 1_000_099);
        _assertGolden(100, 1_000_000, true, 1_010_049);
        _assertGolden(-100, 1_000_000, false, 1_010_049);
        _assertGolden(6931, 1_000_000, true, 1_999_836);
        _assertGolden(-6931, 1_000_000, true, 500_040);
        _assertGolden(200_000, 1_000_000, true, 484_680_305_025_733);
        _assertGolden(200_000, 1e18, false, 2_063_215_669);
        _assertGolden(500_000, 1, true, 5_171_760_815_372_400_971_558);
        _assertGolden(-887_272, 1000, false, 340_256_786_698_763_678_858_396_856_460_488_307_819_979);
    }

    function test_staleFailsClosed() public {
        assertEq(hook.oldestTimestamp(key.toId()), uint32(block.timestamp));
        vm.expectRevert(WindowOutOfRange.selector);
        hook.consult(key, 59);
        vm.expectRevert(WindowOutOfRange.selector);
        hook.consult(key, 3601);
        vm.expectRevert(InsufficientHistory.selector);
        hook.consult(key, 60);
        vm.expectRevert(InsufficientHistory.selector);
        hook.quote(key, true, 1, 60);

        PoolKey memory unknown = key;
        unknown.fee = 42;
        assertEq(hook.oldestTimestamp(unknown.toId()), 0);
        vm.expectRevert(InsufficientHistory.selector);
        hook.consult(unknown, 60);

        vm.expectRevert(RivalOracleHook.OnlySelf.selector);
        hook.recordObservation(key);
    }

    function _assertMonotonic(bool zeroForOne) internal view {
        uint128[6] memory amounts = [uint128(0), 1, 1_000, 1_000_000, 1e12, 1e18];
        uint256 prev;
        for (uint256 i = 0; i < amounts.length; i++) {
            uint256 out = hook.quote(key, zeroForOne, amounts[i], 60);
            assertGe(out, prev);
            prev = out;
        }
    }

    function _assertGolden(int24 tick, uint128 amountIn, bool zeroForOne, uint256 expected) internal {
        PoolKey memory priced = _poolKey(goldenFee++);
        int24 opened = manager.initialize(priced, TickMath.getSqrtPriceAtTick(tick));
        assertEq(opened, tick);
        vm.warp(block.timestamp + 60);
        assertEq(hook.consult(priced, 60), tick);
        assertEq(hook.quote(priced, zeroForOne, amountIn, 60), expected);
        vm.warp(block.timestamp - 60);
    }

    function _mineHook(IPoolManager poolManager) internal returns (RivalOracleHook mined) {
        (address predicted, bytes32 salt) =
            HookMiner.find(address(this), FLAGS, type(RivalOracleHook).creationCode, abi.encode(poolManager));
        mined = new RivalOracleHook{salt: salt}(poolManager);
        assertEq(address(mined), predicted);
    }

    function _poolKey(uint24 fee) internal view returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: fee,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    function _modify(PoolKey memory poolKey, int256 liquidityDelta) internal {
        liquidityRouter.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({tickLower: -12_000, tickUpper: 12_000, liquidityDelta: liquidityDelta, salt: 0}),
            ""
        );
    }

    function _swap(PoolKey memory poolKey, int256 amountSpecified, bool zeroForOne, uint160 limit)
        internal
        returns (BalanceDelta)
    {
        return swapRouter.swap(
            poolKey,
            SwapParams({zeroForOne: zeroForOne, amountSpecified: amountSpecified, sqrtPriceLimitX96: limit}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
    }

    function _swapToward(int24 target) internal returns (int24 moved) {
        (, int24 tick,,) = manager.getSlot0(key.toId());
        if (tick == target) return tick;
        bool zeroForOne = target < tick;
        _swap(key, -int256(1e24), zeroForOne, TickMath.getSqrtPriceAtTick(target));
        (, moved,,) = manager.getSlot0(key.toId());
    }

    function _callBeforeSwap(PoolKey memory poolKey, bool zeroForOne, int256 amount, uint160 limit)
        internal
        returns (bytes4 sel, BeforeSwapDelta hookDelta, uint24 fee)
    {
        vm.prank(address(manager));
        (sel, hookDelta, fee) = hook.beforeSwap(
            address(this),
            poolKey,
            SwapParams({zeroForOne: zeroForOne, amountSpecified: amount, sqrtPriceLimitX96: limit}),
            ""
        );
    }

    function _writeTick(PoolId id, int24 tick) internal {
        bytes32 slot = keccak256(abi.encodePacked(PoolId.unwrap(id), bytes32(uint256(6))));
        bytes32 raw = vm.load(address(manager), slot);
        bytes32 updated;
        assembly ("memory-safe") {
            let cleared := and(raw, not(shl(160, 0xFFFFFF)))
            updated := or(cleared, shl(160, and(tick, 0xFFFFFF)))
        }
        vm.store(address(manager), slot, updated);
    }

    function _containsSelector(bytes memory reason, bytes4 sel) internal pure returns (bool) {
        if (reason.length < 4) return false;
        for (uint256 i = 0; i <= reason.length - 4; i++) {
            bytes4 got;
            assembly ("memory-safe") {
                got := mload(add(add(reason, 32), i))
            }
            if (got == sel) return true;
        }
        return false;
    }
}
