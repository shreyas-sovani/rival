// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {IRivalOracle} from "../interfaces/IRivalOracle.sol";
import {InsufficientHistory, WindowOutOfRange} from "../Types.sol";

/// @title RivalOracleHook
/// @notice Uniswap v4 block-start TWAP. One observation per pool per timestamp.
/// @dev The segment from observation o1 to the next observation o2 is priced at `o2.blockStartTick`
///      (the pre-swap tick captured when o2 was written). `beforeSwap` never reverts: the write runs
///      in `recordObservation` under `try/catch`.
contract RivalOracleHook is BaseHook, IRivalOracle {
    using StateLibrary for IPoolManager;

    /// @notice Ring capacity. Cardinality grows until this, then the index wraps.
    uint16 public constant RING = 256;

    /// @notice `recordObservation` is only reachable from this contract.
    error OnlySelf();

    struct Observation {
        uint32 ts;
        int56 tickCumulative;
        int24 blockStartTick;
    }

    struct PoolState {
        uint16 index;
        uint16 cardinality;
        Observation[256] observations;
    }

    mapping(PoolId id => PoolState) private _pools;

    constructor(IPoolManager _manager) BaseHook(_manager) {}

    /// @inheritdoc BaseHook
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @inheritdoc IRivalOracle
    function consult(PoolKey calldata key, uint32 window) external view returns (int24) {
        if (window < 60 || window > 3600) revert WindowOutOfRange();
        PoolId id = key.toId();
        PoolState storage pool = _pools[id];
        uint16 card = pool.cardinality;
        if (card == 0) revert InsufficientHistory();

        uint32 nowTs = uint32(block.timestamp);
        uint32 target = nowTs - window;
        uint16 index = pool.index;
        uint16 oldest = (index + 1) % card;
        if (pool.observations[oldest].ts > target) revert InsufficientHistory();

        int24 tickEnd = _tickEnd(id, pool, nowTs);
        int256 cumNow = _cumAt(id, pool, nowTs, tickEnd);
        int256 cumTarget = _cumAt(id, pool, target, tickEnd);
        int256 avg = _floorDiv(cumNow - cumTarget, int256(uint256(window)));
        return int24(avg);
    }

    /// @inheritdoc IRivalOracle
    function quote(PoolKey calldata key, bool zeroForOne, uint128 amountIn, uint32 window)
        external
        view
        returns (uint256)
    {
        int24 avgTick = this.consult(key, window);
        return _quoteAtTick(avgTick, amountIn, zeroForOne);
    }

    /// @inheritdoc IRivalOracle
    function oldestTimestamp(PoolId id) external view returns (uint32) {
        PoolState storage pool = _pools[id];
        uint16 card = pool.cardinality;
        if (card == 0) return 0;
        uint16 oldest = (pool.index + 1) % card;
        return pool.observations[oldest].ts;
    }

    /// @notice Newest ring index and how many slots are populated (max 256).
    function ringState(PoolId id) external view returns (uint16 index, uint16 cardinality) {
        PoolState storage pool = _pools[id];
        return (pool.index, pool.cardinality);
    }

    /// @notice Observation stored at a physical ring slot.
    function observation(PoolId id, uint16 slot)
        external
        view
        returns (uint32 ts, int56 tickCumulative, int24 blockStartTick)
    {
        Observation storage o = _pools[id].observations[slot];
        return (o.ts, o.tickCumulative, o.blockStartTick);
    }

    /// @notice Infallible observation write. Called only via `try this.recordObservation`.
    function recordObservation(PoolKey calldata key) external {
        if (msg.sender != address(this)) revert OnlySelf();
        PoolId id = key.toId();
        PoolState storage pool = _pools[id];
        uint16 card = pool.cardinality;
        if (card == 0) return;

        uint32 nowTs = uint32(block.timestamp);
        Observation storage latest = pool.observations[pool.index];
        if (nowTs == latest.ts) return;

        (, int24 tickBeforeSwap,,) = poolManager.getSlot0(id);

        int56 newCum;
        unchecked {
            uint32 dt = nowTs - latest.ts;
            newCum = latest.tickCumulative + int56(tickBeforeSwap) * int56(uint56(dt));
        }

        uint16 nextIndex;
        if (card < RING) {
            nextIndex = card;
            pool.cardinality = card + 1;
        } else {
            nextIndex = (pool.index + 1) % RING;
        }
        pool.observations[nextIndex] =
            Observation({ts: nowTs, tickCumulative: newCum, blockStartTick: tickBeforeSwap});
        pool.index = nextIndex;
    }

    function _afterInitialize(address, PoolKey calldata key, uint160, int24 tick)
        internal
        override
        returns (bytes4)
    {
        PoolState storage pool = _pools[key.toId()];
        pool.observations[0] = Observation({ts: uint32(block.timestamp), tickCumulative: 0, blockStartTick: tick});
        pool.cardinality = 1;
        pool.index = 0;
        return BaseHook.afterInitialize.selector;
    }

    function _beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        try this.recordObservation(key) {} catch {}
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function _tickEnd(PoolId id, PoolState storage pool, uint32 nowTs) internal view returns (int24) {
        Observation storage latest = pool.observations[pool.index];
        if (latest.ts == nowTs) return latest.blockStartTick;
        (, int24 tick,,) = poolManager.getSlot0(id);
        return tick;
    }

    function _cumAt(PoolId, PoolState storage pool, uint32 time, int24 tickEnd) internal view returns (int256) {
        Observation storage latest = pool.observations[pool.index];
        if (time >= latest.ts) {
            unchecked {
                uint32 dt = time - latest.ts;
                int56 cum = latest.tickCumulative + int56(tickEnd) * int56(uint56(dt));
                return int256(cum);
            }
        }
        (Observation memory o1, Observation memory o2) = _binarySearch(pool, time);
        unchecked {
            uint32 dt = time - o1.ts;
            int56 cum = o1.tickCumulative + int56(o2.blockStartTick) * int56(uint56(dt));
            return int256(cum);
        }
    }

    /// @dev Finds o1.ts <= time < o2.ts in chronological ring order.
    function _binarySearch(PoolState storage pool, uint32 time)
        internal
        view
        returns (Observation memory o1, Observation memory o2)
    {
        uint16 card = pool.cardinality;
        uint256 l = (uint256(pool.index) + 1) % card;
        uint256 r = l + card - 1;
        for (uint256 n = 0; n < 16; n++) {
            uint256 i = (l + r) / 2;
            o1 = pool.observations[i % card];
            o2 = pool.observations[(i + 1) % card];
            if (o1.ts <= time && time < o2.ts) return (o1, o2);
            if (o1.ts > time) r = i - 1;
            else l = i + 1;
        }
        revert InsufficientHistory();
    }

    /// @dev Toward negative infinity. `d` is a positive window in this contract.
    function _floorDiv(int256 n, int256 d) internal pure returns (int256 q) {
        q = n / d;
        if (n % d != 0 && ((n < 0) != (d < 0))) {
            unchecked {
                q -= 1;
            }
        }
    }

    /// @dev Uniswap v3 `OracleLibrary.getQuoteAtTick`. `zeroForOne` is the `baseToken < quoteToken` branch.
    function _quoteAtTick(int24 tick, uint128 baseAmount, bool zeroForOne) internal pure returns (uint256 quoteAmount) {
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(tick);
        if (sqrtPriceX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtPriceX96) * sqrtPriceX96;
            quoteAmount = zeroForOne
                ? FullMath.mulDiv(ratioX192, baseAmount, 1 << 192)
                : FullMath.mulDiv(1 << 192, baseAmount, ratioX192);
        } else {
            uint256 ratioX128 = FullMath.mulDiv(sqrtPriceX96, sqrtPriceX96, 1 << 64);
            quoteAmount = zeroForOne
                ? FullMath.mulDiv(ratioX128, baseAmount, 1 << 128)
                : FullMath.mulDiv(1 << 128, baseAmount, ratioX128);
        }
    }
}
