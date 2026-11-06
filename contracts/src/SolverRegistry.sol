// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {SafeTransferLib} from "solady/src/utils/SafeTransferLib.sol";

import {IRivalNames} from "./interfaces/IRivalNames.sol";
import {LabelUnavailable, Stats, Unauthorized} from "./Types.sol";
import {ISolverRegistry} from "./interfaces/ISolverRegistry.sol";

/// @title SolverRegistry
/// @notice Listing deposit, one name per solver, fill stats, and ENS-backed gating.
/// @dev Production deploy passes `depositAmount = 100e6` (100 tUSDC, 6 decimals). The value is
///      the immutable the deployer supplies. See docs/ens-design.md.
contract SolverRegistry is ISolverRegistry {
    using SafeTransferLib for address;

    /// @notice Listing term applied on register and on each counted fill.
    uint64 public constant LISTING_TERM = 30 days;

    /// @notice ERC20 pulled and refunded in full. Production: tUSDC.
    address public immutable depositToken;

    /// @notice Exact deposit. Not hardcoded; the constructor argument is stored.
    uint256 public immutable depositAmount;

    /// @notice Name issuer.
    IRivalNames public immutable names;

    /// @notice The only address allowed to register the label `house`.
    address public immutable house;

    /// @notice Settlement contract. Zero until {setSettlement}.
    address public settlement;

    /// @dev Set on the first {setSettlement}, including a call that passes `address(0)`.
    bool public settlementLocked;

    /// @dev Reentrancy lock for {register} and {exit}.
    uint256 private _locked;

    mapping(address solver => string label) internal _labels;
    mapping(bytes32 labelHash => address solver) internal _labelOwner;
    mapping(address solver => Stats stats) internal _stats;
    mapping(address solver => mapping(address maker => bool seen)) internal _seenMaker;

    constructor(address depositToken_, uint256 depositAmount_, IRivalNames names_, address house_) {
        depositToken = depositToken_;
        depositAmount = depositAmount_;
        names = names_;
        house = house_;
    }

    modifier lock() {
        if (_locked != 0) revert Unauthorized();
        _locked = 1;
        _;
        _locked = 0;
    }

    /// @inheritdoc ISolverRegistry
    function setSettlement(address settlement_) external {
        if (settlementLocked) revert Unauthorized();
        settlementLocked = true;
        settlement = settlement_;
    }

    /// @inheritdoc ISolverRegistry
    function register(string calldata label) external lock {
        if (bytes(_labels[msg.sender]).length != 0) revert LabelUnavailable();
        if (!_validLabel(label)) revert LabelUnavailable();
        bytes32 labelHash = keccak256(bytes(label));
        if (_reserved(labelHash, msg.sender)) revert LabelUnavailable();
        if (_labelOwner[labelHash] != address(0)) revert LabelUnavailable();

        _labels[msg.sender] = label;
        _labelOwner[labelHash] = msg.sender;

        depositToken.safeTransferFrom(msg.sender, address(this), depositAmount);
        names.issue(label, msg.sender, uint64(block.timestamp) + LISTING_TERM);
    }

    /// @inheritdoc ISolverRegistry
    function exit() external lock {
        string memory label = _labels[msg.sender];
        if (bytes(label).length == 0) revert Unauthorized();

        names.unregister(msg.sender);

        delete _labelOwner[keccak256(bytes(label))];
        delete _labels[msg.sender];

        depositToken.safeTransfer(msg.sender, depositAmount);
    }

    /// @inheritdoc ISolverRegistry
    function isListed(address solver) external view returns (bool listed) {
        return _listed(solver);
    }

    /// @inheritdoc ISolverRegistry
    /// @dev Label hash is `keccak256(bytes(label))`, the raw label bytes. See docs/ens-design.md.
    function ownsAny(address solver, bytes32[] calldata labelHashes) external view returns (bool ok) {
        if (!_listed(solver)) return false;
        bytes32 own = keccak256(bytes(_labels[solver]));
        uint256 length = labelHashes.length;
        for (uint256 i; i < length; ++i) {
            if (labelHashes[i] == own) return true;
        }
        return false;
    }

    /// @inheritdoc ISolverRegistry
    function onFill(address solver, address maker, int32 improvementBps) external {
        if (msg.sender != settlement) revert Unauthorized();

        Stats storage stats_ = _stats[solver];
        stats_.fills += 1;
        if (!_seenMaker[solver][maker]) {
            _seenMaker[solver][maker] = true;
            stats_.makers += 1;
        }
        stats_.sumImprovementBps += int128(improvementBps);
        stats_.lastFill = uint64(block.timestamp);

        try names.renew(solver, uint64(block.timestamp) + LISTING_TERM) {} catch {}
    }

    /// @inheritdoc ISolverRegistry
    function stats(address solver) external view returns (Stats memory) {
        return _stats[solver];
    }

    /// @inheritdoc ISolverRegistry
    function syncRecords(address solver) external {
        if (bytes(_labels[solver]).length == 0) revert LabelUnavailable();
        Stats memory stats_ = _stats[solver];
        int256 avg;
        if (stats_.fills != 0) {
            avg = int256(stats_.sumImprovementBps) / int256(uint256(stats_.fills));
        }
        names.syncRecords(solver, stats_.fills, stats_.makers, avg, stats_.lastFill);
    }

    /// @notice Label stored for `solver`, or empty when they have no listing.
    function labelOf(address solver) external view returns (string memory) {
        return _labels[solver];
    }

    function _listed(address solver) internal view returns (bool) {
        uint256 tokenId = names.tokenIdOf(solver);
        if (tokenId == 0) return false;
        try IEnsOwnerOf(address(names)).ownerOf(tokenId) returns (address owner) {
            return owner == solver;
        } catch {
            return false;
        }
    }

    function _validLabel(string calldata label) internal pure returns (bool) {
        bytes calldata raw = bytes(label);
        uint256 length = raw.length;
        if (length < 3 || length > 24) return false;
        for (uint256 i; i < length; ++i) {
            bytes1 c = raw[i];
            bool digit = c >= 0x30 && c <= 0x39;
            bool lower = c >= 0x61 && c <= 0x7a;
            if (!digit && !lower && c != 0x2d) return false;
        }
        return true;
    }

    function _reserved(bytes32 labelHash, address caller) internal view returns (bool) {
        if (labelHash == keccak256(bytes("rival"))) return true;
        if (labelHash == keccak256(bytes("admin"))) return true;
        if (labelHash == keccak256(bytes("official"))) return true;
        if (labelHash == keccak256(bytes("house"))) return caller != house;
        return false;
    }
}

interface IEnsOwnerOf {
    function ownerOf(uint256 tokenId) external view returns (address);
}
