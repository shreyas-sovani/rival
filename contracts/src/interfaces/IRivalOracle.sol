// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

/// @title IRivalOracle
/// @notice Block-start TWAP implemented by `RivalOracleHook` (PRD FR-HOK-03).
/// @dev Types {PoolKey} and {PoolId} are imported from pinned v4-core 1.0.2
///      (gitHead 59d3ecf53afa9264a16bba0e38f4c5d2231f80bc, src/types/PoolKey.sol, src/types/PoolId.sol).
///      Expected remapping: lib/v4-core/ under the package import prefix.
///      `consult` in block N does not move when swaps in block N move the tick (invariant I8).
interface IRivalOracle {
    /// @notice Time-weighted mean tick over `[block.timestamp - window, block.timestamp]`, excluding same-block movement.
    /// @param key Pool key. The hook must be this contract's pool.
    /// @param window Seconds. Must be in [60, 3600].
    /// @return avgTick Arithmetic mean tick, rounded toward negative infinity (Uniswap v3 convention).
    /// @dev Reverts with {InsufficientHistory} when the oldest observation is newer than `block.timestamp - window`.
    ///      Reverts with {WindowOutOfRange} when `window` is outside [60, 3600].
    ///      Reverts when the pool has not been initialized.
    function consult(PoolKey calldata key, uint32 window) external view returns (int24 avgTick);

    /// @notice Convert `amountIn` through the consulted mean tick. Mid price: fees and price impact are not applied.
    /// @param key Pool key.
    /// @param zeroForOne True when `amountIn` is `currency0` and the output is `currency1`.
    /// @param amountIn Exact input in the input currency's base units.
    /// @param window Seconds, same bounds as {consult}.
    /// @return amountOut Output in the other currency's base units, before fees and impact.
    /// @dev Reverts with the same errors as {consult}. Monotonic in `amountIn` for a fixed tick.
    function quote(PoolKey calldata key, bool zeroForOne, uint128 amountIn, uint32 window)
        external
        view
        returns (uint256 amountOut);

    /// @notice Timestamp of the oldest observation still in the ring, or zero when the pool has no observations.
    /// @param id Pool id (`keccak256(abi.encode(poolKey))`, 0xa0 bytes).
    /// @return Unix timestamp of the oldest stored observation.
    function oldestTimestamp(PoolId id) external view returns (uint32);
}
