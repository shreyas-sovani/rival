// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";

import {EACBaseRolesLib} from "@ensdomains/contracts-v2/contracts/src/access-control/libraries/EACBaseRolesLib.sol";
import {ILabelStore} from "@ensdomains/contracts-v2/contracts/src/utils/interfaces/ILabelStore.sol";
import {IStandardRegistry} from "@ensdomains/contracts-v2/contracts/src/registry/interfaces/IStandardRegistry.sol";
import {PermissionedRegistry} from "@ensdomains/contracts-v2/contracts/src/registry/PermissionedRegistry.sol";
import {RegistryRolesLib} from "@ensdomains/contracts-v2/contracts/src/registry/libraries/RegistryRolesLib.sol";

import {RivalNames} from "../../src/ens/RivalNames.sol";

contract MockLabelStore is ILabelStore {
    function setLabel(string calldata) external {}

    function getLabel(uint256) external pure returns (string memory) {
        return "";
    }
}

/// @notice Deploys a real `PermissionedRegistry` from contracts-v2 and a `RivalNames` wired to it.
contract EnsHarness is Test {
    function _deployEns() internal returns (PermissionedRegistry ens, RivalNames names) {
        MockLabelStore store = new MockLabelStore();
        ens = new PermissionedRegistry(ILabelStore(address(store)), address(this), EACBaseRolesLib.ALL_ROLES);
        names = new RivalNames(address(this), IStandardRegistry(address(ens)), address(0));
        ens.grantRootRoles(
            RegistryRolesLib.ROLE_REGISTRAR | RegistryRolesLib.ROLE_RENEW | RegistryRolesLib.ROLE_UNREGISTER,
            address(names)
        );
    }
}
