// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ISolverRegistry} from "../../src/interfaces/ISolverRegistry.sol";
import {LabelUnavailable, Stats, Unauthorized} from "../../src/Types.sol";

/// @notice Gating and stats stub. View reads revert when the matching `fail*` flag is set.
contract MockRegistry is ISolverRegistry {
    bool public listed = true;
    bool public owns = true;
    bool public failListed;
    bool public failOwns;
    bool public failFill;
    bool public failSync;

    uint256 public fills;
    uint256 public syncs;
    bool public syncTried;
    address public lastSolver;
    address public lastMaker;
    int32 public lastBps;

    function setListed(bool value) external {
        listed = value;
    }

    function setOwns(bool value) external {
        owns = value;
    }

    function setFailListed(bool value) external {
        failListed = value;
    }

    function setFailOwns(bool value) external {
        failOwns = value;
    }

    function setFailFill(bool value) external {
        failFill = value;
    }

    function setFailSync(bool value) external {
        failSync = value;
    }

    function setSettlement(address) external {}

    function register(string calldata) external {}

    function exit() external {}

    function isListed(address) external view returns (bool) {
        if (failListed) revert Unauthorized();
        return listed;
    }

    function ownsAny(address, bytes32[] calldata) external view returns (bool) {
        if (failOwns) revert Unauthorized();
        return owns;
    }

    function onFill(address solver, address maker, int32 improvementBps) external {
        if (failFill) revert Unauthorized();
        fills += 1;
        lastSolver = solver;
        lastMaker = maker;
        lastBps = improvementBps;
    }

    function stats(address) external view returns (Stats memory s) {
        s.fills = uint64(fills);
    }

    function syncRecords(address) external {
        syncTried = true;
        if (failSync) revert LabelUnavailable();
        syncs += 1;
    }
}
