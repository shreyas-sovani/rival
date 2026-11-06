// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IRegistry} from "@ensdomains/contracts-v2/contracts/src/registry/interfaces/IRegistry.sol";
import {IStandardRegistry} from "@ensdomains/contracts-v2/contracts/src/registry/interfaces/IStandardRegistry.sol";

import {IRivalNames} from "../interfaces/IRivalNames.sol";
import {LabelUnavailable, Unauthorized} from "../Types.sol";

interface IEnsText {
    /// @dev Canonical Sepolia PermissionedResolver. The name is DNS-encoded.
    function setText(bytes calldata name, string calldata key, string calldata value) external;
}

/// @title RivalNames
/// @notice Issues solver labels on an ENSv2 `PermissionedRegistry` and stores protocol stats.
/// @dev The registry role bitmap cannot name individual text keys. When `resolver` is
///      set, {syncRecords} also calls `setText` on `label.solvers.rival.eth`. The deployed
///      constructor argument is still `address(0)`, so that path does not run on Sepolia
///      until RivalNames is redeployed. Storage remains the record either way.
///      See docs/ens-design.md.
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

    /// @notice Label passed to the last {issue}. Used only to namehash the text node.
    mapping(address solver => string label) internal _labels;

    struct ProtocolRecord {
        uint64 fills;
        uint64 makers;
        int256 avgImprovementBps;
        uint64 lastFill;
    }

    /// @notice Protocol stats. Mirrored with `setText` when `resolver` is set.
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
        _labels[solver] = label;
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
        delete _labels[solver];
    }

    /// @inheritdoc IRivalNames
    /// @dev Always stores the four stats. Calls resolver `setText` only when `resolver` is set
    ///      and this solver has a stored label. The name is the DNS encoding of
    ///      `label.solvers.rival.eth`, which is what the canonical Sepolia resolver expects.
    ///      A refusing resolver reverts this call, which rolls the storage write back.
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
        if (resolver == address(0)) return;
        string memory label = _labels[solver];
        if (bytes(label).length == 0) return;
        bytes memory dnsName = _dnsName(label);
        IEnsText writer = IEnsText(resolver);
        writer.setText(dnsName, "com.rival.fills", Strings.toString(fills));
        writer.setText(dnsName, "com.rival.makers", Strings.toString(makers));
        writer.setText(dnsName, "com.rival.avgImprovementBps", Strings.toStringSigned(avgImprovementBps));
        writer.setText(dnsName, "com.rival.lastFill", Strings.toString(lastFill));
    }

    /// @dev DNS wire form of `label.solvers.rival.eth`. Label length is 3 to 24.
    function _dnsName(string memory label) internal pure returns (bytes memory) {
        return abi.encodePacked(uint8(bytes(label).length), label, hex"07736f6c7665727305726976616c0365746800");
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
