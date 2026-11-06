// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IStandardRegistry} from "@ensdomains/contracts-v2/contracts/src/registry/interfaces/IStandardRegistry.sol";
import {RegistryRolesLib} from "@ensdomains/contracts-v2/contracts/src/registry/libraries/RegistryRolesLib.sol";

/// @notice Minimal ENS stand-in for unit tests. Implements the calls RivalNames makes.
contract MockEns {
    struct Rec {
        address owner;
        uint64 expiry;
        uint256 roleBitmap;
        bool exists;
    }

    mapping(uint256 => Rec) public recs;
    uint256 public nextId = 1;

    bool public revertRegister;
    bool public revertRenew;
    bool public revertUnregister;
    bool public revertOwnerOf;

    function setRevertRegister(bool value) external {
        revertRegister = value;
    }

    function setRevertRenew(bool value) external {
        revertRenew = value;
    }

    function setRevertUnregister(bool value) external {
        revertUnregister = value;
    }

    function setRevertOwnerOf(bool value) external {
        revertOwnerOf = value;
    }

    function register(
        string calldata,
        address owner,
        address,
        address,
        uint256 roleBitmap,
        uint64 expiry
    )
        external
        returns (uint256 tokenId)
    {
        if (revertRegister) revert("register failed");
        tokenId = nextId++;
        recs[tokenId] = Rec({owner: owner, expiry: expiry, roleBitmap: roleBitmap, exists: true});
    }

    function renew(uint256 tokenId, uint64 newExpiry) external {
        if (revertRenew) revert("renew failed");
        Rec storage rec = recs[tokenId];
        if (!rec.exists) revert IStandardRegistry.LabelExpired(tokenId);
        if (newExpiry < rec.expiry) revert IStandardRegistry.CannotReduceExpiry(rec.expiry, newExpiry);
        rec.expiry = newExpiry;
    }

    function unregister(uint256 tokenId) external {
        if (revertUnregister) revert("unregister failed");
        Rec storage rec = recs[tokenId];
        // Pinned PermissionedRegistry.unregister reverts LabelExpired once timestamp >= expiry.
        if (!rec.exists || block.timestamp >= rec.expiry) revert IStandardRegistry.LabelExpired(tokenId);
        rec.owner = address(0);
        rec.expiry = uint64(block.timestamp);
        rec.exists = false;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        if (revertOwnerOf) revert("ownerOf");
        Rec memory rec = recs[tokenId];
        if (!rec.exists) return address(0);
        if (block.timestamp >= rec.expiry) return address(0);
        return rec.owner;
    }

    function getExpiry(uint256 tokenId) external view returns (uint64) {
        return recs[tokenId].expiry;
    }

    function setOwner(uint256 tokenId, address owner) external {
        recs[tokenId].owner = owner;
    }

    /// @notice Refuses the transfer when the issued bitmap omits `ROLE_CAN_TRANSFER_ADMIN`.
    function safeTransferFrom(address from, address, uint256 id, uint256, bytes calldata) external view {
        Rec memory rec = recs[id];
        if (from != rec.owner || rec.roleBitmap & RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN == 0) {
            revert IStandardRegistry.TransferDisallowed(id, from);
        }
    }
}
