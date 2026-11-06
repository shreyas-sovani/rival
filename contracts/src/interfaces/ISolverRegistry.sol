// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Stats} from "../Types.sol";

/// @title ISolverRegistry
/// @notice Listing deposit, one ENS name per solver, and fill stats. Gating reads ENS and fails closed.
/// @dev `setSettlement` is the one-time binder from PRD §9.4. It is not in the §7.1 snippet; it is frozen here so deployment does not require a later interface bump.
interface ISolverRegistry {
    /// @notice Bind the settlement contract. First caller sets it; a second call reverts.
    /// @param settlement RivalSettlement address. Only this address may call {onFill}.
    /// @dev Reverts with {Unauthorized} after the address is set, including a call with the same address.
    function setSettlement(address settlement) external;

    /// @notice Pull the listing deposit (100 tUSDC), issue the solver's ENS name, and store the token id.
    /// @param label 3–24 characters, `[a-z0-9-]`. Reserved labels (`rival`, `admin`, `official`, `house` except the house key) revert.
    /// @dev Reverts with {LabelUnavailable} when the label is invalid, reserved, taken, or this solver already has a name.
    ///      Reverts (bubbling the ENS error) when name issuance fails. The deposit move and the name issue are atomic.
    function register(string calldata label) external;

    /// @notice Unregister the caller's ENS name and refund the listing deposit exactly.
    /// @dev Reverts with {Unauthorized} when the caller has no listing. ENS unregister failure reverts the refund.
    function exit() external;

    /// @notice True when the solver's stored ENS token id is still owned by `solver`.
    /// @param solver Solver address.
    /// @return listed False when unknown, expired, stale, or when the ENS read reverts (fail closed).
    /// @dev Does not revert on ENS failure.
    function isListed(address solver) external view returns (bool listed);

    /// @notice True when `solver` is listed and the hash of their own label is in `labelHashes`.
    /// @param solver Solver address.
    /// @param labelHashes Allowlist passed by the filler. Must already have matched `Intent.allowlistHash`.
    /// @return ok False when the solver is not listed or their label hash is absent. ENS failure yields false.
    function ownsAny(address solver, bytes32[] calldata labelHashes) external view returns (bool ok);

    /// @notice Record a fill. Called only by settlement, and only for non-sentinel receipts.
    /// @param solver Filler (`msg.sender` of `fill`).
    /// @param maker Intent maker. Counted once per solver.
    /// @param improvementBps Receipt value. Sentinel `type(int32).min` must not be forwarded.
    /// @dev Reverts with {Unauthorized} when `msg.sender` is not settlement.
    ///      ENS record sync is not part of this call's success; settlement invokes {syncRecords} separately and ignores its failure.
    function onFill(address solver, address maker, int32 improvementBps) external;

    /// @notice Storage stats for a solver. Zeroed struct when the solver has never been listed.
    /// @param solver Solver address.
    /// @return Current counters.
    function stats(address solver) external view returns (Stats memory);

    /// @notice Retry the ENS text-record write for protocol-owned `com.rival.*` keys.
    /// @param solver Solver address.
    /// @dev Callable by anyone. Reverts with {LabelUnavailable} when the solver has no stored name.
    ///      A revert from ENS propagates so the caller can retry; `fill` must catch that revert.
    function syncRecords(address solver) external;
}
