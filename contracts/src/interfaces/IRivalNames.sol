// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IRivalNames
/// @notice Glue between {ISolverRegistry} and the ENSv2 solvers registry. Settlement never calls this directly.
/// @dev Names are issued without `ROLE_CAN_TRANSFER_ADMIN` (non-transferable). Protocol text keys `com.rival.*` are writable only by this contract. Solver-editable agent records are not written here.
interface IRivalNames {
    /// @notice Register `label` under `solvers.<parent>.eth` for `solver`.
    /// @param label DNS label, already validated by the registry.
    /// @param solver Owner of the name. Receives only the roles needed to edit their own agent records.
    /// @param expiry Unix expiry. The registry passes `block.timestamp + 30 days` on issue.
    /// @return tokenId ENS token id returned by `register`. The registry stores this id and must not change roles afterwards (role changes regenerate the id).
    /// @dev Reverts with {LabelUnavailable} when ENS rejects the label, and with {Unauthorized} when the caller is not the registry.
    function issue(string calldata label, address solver, uint64 expiry) external returns (uint256 tokenId);

    /// @notice Extend the name's expiry to at least `expiry` (`max(current, expiry)` is the registry's responsibility to compute).
    /// @param solver Solver whose stored token id is renewed.
    /// @param expiry New expiry timestamp.
    /// @dev Reverts with {Unauthorized} when the caller is not the registry. Reverts with the ENS error when `renew` fails. Callers that must not block a fill catch this.
    function renew(address solver, uint64 expiry) external;

    /// @notice Unregister the solver's name.
    /// @param solver Solver address.
    /// @dev Reverts with {Unauthorized} when the caller is not the registry. Reverts with the ENS error when `unregister` fails.
    function unregister(address solver) external;

    /// @notice Write `com.rival.fills`, `com.rival.makers`, `com.rival.avgImprovementBps`, and `com.rival.lastFill`.
    /// @param solver Solver address.
    /// @param fills Stat counter.
    /// @param makers Distinct-maker counter.
    /// @param avgImprovementBps `sumImprovementBps / fills`, or zero when `fills` is zero. Truncates toward zero.
    /// @param lastFill Timestamp of the latest counted fill.
    /// @dev Reverts with {Unauthorized} when the caller is not the registry. Reverts with the ENS access-control error when the resolver refuses the write.
    function syncRecords(address solver, uint64 fills, uint64 makers, int256 avgImprovementBps, uint64 lastFill)
        external;

    /// @notice ENS token id stored at issue for `solver`, or zero when none.
    /// @param solver Solver address.
    /// @return tokenId Stored id. A stale id (solver changed roles) still returns; {ISolverRegistry.isListed} treats a mismatched `ownerOf` as unlisted.
    function tokenIdOf(address solver) external view returns (uint256 tokenId);
}
