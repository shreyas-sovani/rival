// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IStandardRegistry} from "@ensdomains/contracts-v2/contracts/src/registry/interfaces/IStandardRegistry.sol";
import {PermissionedRegistry} from "@ensdomains/contracts-v2/contracts/src/registry/PermissionedRegistry.sol";
import {RegistryRolesLib} from "@ensdomains/contracts-v2/contracts/src/registry/libraries/RegistryRolesLib.sol";

import {RivalNames} from "../../src/ens/RivalNames.sol";
import {EnsHarness} from "./EnsHarness.sol";

/// @notice Executes register / ownerOf / unregister against the pinned PermissionedRegistry.
contract RivalNamesIntegrationTest is EnsHarness {
    function test_registerOwnerOfRenewUnregisterOnPinnedRegistry() public {
        (PermissionedRegistry ens, RivalNames names) = _deployEns();
        address solver = makeAddr("solver");
        uint64 expiry = uint64(block.timestamp + 30 days);

        uint256 tokenId = names.issue("atlas", solver, expiry);
        assertEq(ens.ownerOf(tokenId), solver);
        assertEq(names.tokenIdOf(solver), tokenId);
        assertEq(ens.getExpiry(tokenId), expiry);
        assertEq(ens.roles(tokenId, solver), RivalNames(address(names)).SOLVER_ROLE_BITMAP());
        assertFalse(ens.hasRoles(tokenId, RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN, solver));

        uint64 extended = expiry + 10 days;
        names.renew(solver, extended);
        assertEq(ens.getExpiry(tokenId), extended);
        names.renew(solver, expiry);
        assertEq(ens.getExpiry(tokenId), extended);

        vm.prank(solver);
        vm.expectRevert(abi.encodeWithSelector(IStandardRegistry.TransferDisallowed.selector, tokenId, solver));
        ens.safeTransferFrom(solver, makeAddr("other"), tokenId, 1, "");
        assertEq(ens.ownerOf(tokenId), solver);

        vm.expectRevert(abi.encodeWithSelector(IStandardRegistry.LabelAlreadyRegistered.selector, "atlas"));
        names.issue("atlas", makeAddr("other"), expiry);

        names.syncRecords(solver, 2, 1, -1, uint64(block.timestamp));
        (uint64 fills, uint64 makers, int256 avg, uint64 lastFill) = names.protocolRecord(solver);
        assertEq(fills, 2);
        assertEq(makers, 1);
        assertEq(avg, -1);
        assertEq(lastFill, uint64(block.timestamp));

        names.unregister(solver);
        assertEq(ens.ownerOf(tokenId), address(0));
        assertEq(names.tokenIdOf(solver), 0);

        uint256 fresh = names.issue("atlas", solver, expiry);
        assertNotEq(fresh, tokenId);
        assertEq(ens.ownerOf(fresh), solver);
    }

    /// @dev Pinned registry: at expiry ownerOf is 0, unregister reverts, root ROLE_RENEW can revive.
    function test_pinnedLapseUnregisterRevertsAndRenewRevives() public {
        (PermissionedRegistry ens, RivalNames names) = _deployEns();
        address solver = makeAddr("lapsed");
        uint64 expiry = uint64(block.timestamp + 30 days);
        uint256 tokenId = names.issue("lapse", solver, expiry);

        vm.warp(expiry);
        assertEq(ens.ownerOf(tokenId), address(0));
        vm.expectRevert(abi.encodeWithSelector(IStandardRegistry.LabelExpired.selector, tokenId));
        names.unregister(solver);

        uint64 revived = uint64(block.timestamp + 30 days);
        names.renew(solver, revived);
        assertEq(ens.ownerOf(tokenId), solver);
        assertEq(ens.getExpiry(tokenId), revived);
    }

    /// @dev A role change after issue regenerates the ERC1155 id. The id stored at issue goes stale.
    function test_roleChangeStalesStoredTokenId() public {
        (PermissionedRegistry ens, RivalNames names) = _deployEns();
        address solver = makeAddr("stale");
        uint64 expiry = uint64(block.timestamp + 30 days);
        uint256 tokenId = names.issue("stale", solver, expiry);

        ens.grantRoles(tokenId, RegistryRolesLib.ROLE_RENEW, solver);

        uint256 current = ens.getTokenId(tokenId);
        assertNotEq(current, tokenId);
        assertEq(ens.ownerOf(tokenId), address(0));
        assertEq(ens.ownerOf(current), solver);
        assertEq(names.tokenIdOf(solver), tokenId);
    }
}
