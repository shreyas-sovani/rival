// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IStandardRegistry} from "@ensdomains/contracts-v2/contracts/src/registry/interfaces/IStandardRegistry.sol";
import {PermissionedRegistry} from "@ensdomains/contracts-v2/contracts/src/registry/PermissionedRegistry.sol";

import {RivalNames} from "../../src/ens/RivalNames.sol";
import {EnsHarness} from "./EnsHarness.sol";

/// @notice Same pinned calls as the integration test, on a Sepolia fork when the RPC is set.
/// @dev Does not buy a `.eth` name. The registry is deployed on the fork.
contract RivalNamesForkTest is EnsHarness {
    function test_forkRegisterSucceedsAndTransferReverts() public {
        string memory url = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(url).length == 0) {
            vm.skip(true, "SEPOLIA_RPC_URL unset");
            return;
        }
        vm.createSelectFork(url);

        (PermissionedRegistry ens, RivalNames names) = _deployEns();
        address solver = makeAddr("solver");
        uint64 expiry = uint64(block.timestamp + 30 days);

        uint256 tokenId = names.issue("atlas", solver, expiry);
        assertEq(ens.ownerOf(tokenId), solver);

        vm.prank(solver);
        vm.expectRevert(abi.encodeWithSelector(IStandardRegistry.TransferDisallowed.selector, tokenId, solver));
        ens.safeTransferFrom(solver, makeAddr("other"), tokenId, 1, "");
    }
}
