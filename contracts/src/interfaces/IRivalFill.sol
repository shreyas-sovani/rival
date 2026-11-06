// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IRivalFill
/// @notice Callback implemented by solver contracts that source liquidity inside `fill`.
interface IRivalFill {
    /// @notice Called by settlement during `fill` when `FillParams.useCallback` is true, after the maker's input has been pulled and before settlement pulls `requiredOut`.
    /// @param intentHash EIP-712 struct hash of the intent being filled.
    /// @param tokenIn Token the solver just received (`amountIn` of it, at `FillParams.inputTo`).
    /// @param tokenOut Token the solver must approve to settlement for exactly `requiredOut`.
    /// @param amountIn Input amount just transferred to the solver.
    /// @param requiredOut Minimum — and exact — output settlement will pull. The solver may produce more and keep the surplus.
    /// @param data `FillParams.data`, opaque to settlement.
    /// @dev MUST revert if `msg.sender` is not the settlement contract. A revert here undoes the whole fill; the maker's tokens stay put.
    function rivalFillCallback(
        bytes32 intentHash,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 requiredOut,
        bytes calldata data
    ) external;
}
