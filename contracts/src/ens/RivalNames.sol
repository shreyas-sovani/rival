// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IRegistry} from "@ensdomains/contracts-v2/contracts/src/registry/interfaces/IRegistry.sol";
import {IStandardRegistry} from "@ensdomains/contracts-v2/contracts/src/registry/interfaces/IStandardRegistry.sol";

import {IRivalNames} from "../interfaces/IRivalNames.sol";
import {LabelUnavailable, Unauthorized} from "../Types.sol";

/// @title RivalNames
/// @notice Issues solver labels on an ENSv2 `PermissionedRegistry` and stores protocol stats.
/// @dev The registry role bitmap cannot name individual text keys. PermissionedResolver
///      can (authorizeTextRoles), but that contract does not compile in this checkout:
///      the ens-contracts submodule is empty. com.rival.* therefore lives in this
///      contract. ENS is the identity (register / ownerOf / renew / unregister).
///      See docs/spikes/S3.md and docs/ens-design.md.
contract RivalNames is IRivalNames {
    /// @notice Registry roles granted to the solver on `register`.
    /// @dev Zero omits `ROLE_CAN_TRANSFER_ADMIN` (`(1 << 28) << 128`) and every other
    ///      registry role, including admins. A later role change on the name regenerates
    ///      the ENS token id, so this contract never grants or revokes roles after issue.
    uint256 public constant SOLVER_ROLE_BITMAP = 0;

    /// @notice `SolverRegistry`. The only caller of the mutators below.
    address public immutable registry;

    /// @notice ENSv2 solvers registry (`IStandardRegistry` / `PermissionedRegistry`).
    IStandardRegistry public immutable ens;

    /// @notice Resolver passed to `register`. Unused for protocol stats in the fallback.
    address public immutable resolver;

    /// @notice ENS token id from the last successful {issue}. Zero after {unregister} or when none.
    mapping(address solver => uint256 tokenId) internal _tokenIds;

    struct ProtocolRecord {
        uint64 fills;
        uint64 makers;
        int256 avgImprovementBps;
        uint64 lastFill;
    }

    /// @notice Authoritative `com.rival.*` values. Not mirrored to an ENS text record.
    mapping(address solver => ProtocolRecord record) internal _records;

    constructor(address registry_, IStandardRegistry ens_, address resolver_) {
        registry = registry_;
        ens = ens_;
        resolver = resolver_;
    }

    modifier onlyRegistry() {
        if (msg.sender != registry) revert Unauthorized();
        _;
    }

    /// @inheritdoc IRivalNames
    function issue(string calldata label, address solver, uint64 expiry)
        external
        onlyRegistry
        returns (uint256 tokenId)
    {
        tokenId = ens.register(label, solver, IRegistry(address(0)), resolver, SOLVER_ROLE_BITMAP, expiry);
        _tokenIds[solver] = tokenId;
    }

    /// @inheritdoc IRivalNames
    /// @dev Pinned `PermissionedRegistry.renew` reverts `CannotReduceExpiry` when the new
    ///      timestamp is earlier. This passes `max(current, expiry)`.
    function renew(address solver, uint64 expiry) external onlyRegistry {
        uint256 tokenId = _tokenIds[solver];
        uint64 current = ens.getExpiry(tokenId);
        uint64 next = expiry > current ? expiry : current;
        ens.renew(tokenId, next);
    }

    /// @inheritdoc IRivalNames
    function unregister(address solver) external onlyRegistry {
        uint256 tokenId = _tokenIds[solver];
        if (tokenId == 0) revert LabelUnavailable();
        ens.unregister(tokenId);
        delete _tokenIds[solver];
    }

    /// @inheritdoc IRivalNames
    /// @dev Stores the four protocol stats. Does not call `setText`.
    function syncRecords(address solver, uint64 fills, uint64 makers, int256 avgImprovementBps, uint64 lastFill)
        external
        onlyRegistry
    {
        _records[solver] = ProtocolRecord({
            fills: fills,
            makers: makers,
            avgImprovementBps: avgImprovementBps,
            lastFill: lastFill
        });
    }

    /// @inheritdoc IRivalNames
    function tokenIdOf(address solver) external view returns (uint256 tokenId) {
        return _tokenIds[solver];
    }

    /// @notice ENS `ownerOf` for a token id. Reverts when the registry read reverts.
    /// @dev `SolverRegistry.isListed` catches that revert and returns false.
    function ownerOf(uint256 tokenId) external view returns (address) {
        return ens.ownerOf(tokenId);
    }

    /// @notice Protocol stats last written by {syncRecords}. Zeroes when never synced.
    function protocolRecord(address solver)
        external
        view
        returns (uint64 fills, uint64 makers, int256 avgImprovementBps, uint64 lastFill)
    {
        ProtocolRecord storage record = _records[solver];
        return (record.fills, record.makers, record.avgImprovementBps, record.lastFill);
    }
}
