// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {EACBaseRolesLib} from "@ensdomains/contracts-v2/contracts/src/access-control/libraries/EACBaseRolesLib.sol";
import {ILabelStore} from "@ensdomains/contracts-v2/contracts/src/utils/interfaces/ILabelStore.sol";
import {IStandardRegistry} from "@ensdomains/contracts-v2/contracts/src/registry/interfaces/IStandardRegistry.sol";
import {PermissionedRegistry} from "@ensdomains/contracts-v2/contracts/src/registry/PermissionedRegistry.sol";
import {RegistryRolesLib} from "@ensdomains/contracts-v2/contracts/src/registry/libraries/RegistryRolesLib.sol";

import {IRivalNames} from "../src/interfaces/IRivalNames.sol";
import {RivalNames} from "../src/ens/RivalNames.sol";
import {SolverRegistry} from "../src/SolverRegistry.sol";
import {MockLabelStore} from "../test/ens/EnsHarness.sol";

/// @notice CREATE2-deployed factory. RivalNames and SolverRegistry are CREATE'd from this
///         contract so their addresses depend only on this factory's address and nonce.
///         Each constructor can then be given the other's predicted address.
contract EnsPairFactory {
    error AddressMismatch(address predicted, address actual);

    function deploy(
        address predictedNames,
        address predictedRegistry,
        IStandardRegistry ens,
        address depositToken,
        uint256 depositAmount,
        address house
    ) external returns (address names, address registry) {
        RivalNames deployedNames = new RivalNames(predictedRegistry, ens, address(0));
        names = address(deployedNames);
        if (names != predictedNames) revert AddressMismatch(predictedNames, names);
        SolverRegistry deployedRegistry = new SolverRegistry(depositToken, depositAmount, IRivalNames(names), house);
        registry = address(deployedRegistry);
        if (registry != predictedRegistry) revert AddressMismatch(predictedRegistry, registry);
    }
}

/// @notice Sepolia solvers registry, RivalNames, and SolverRegistry. Does not register a .eth parent.
contract DeployNames is Script {
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    address internal constant TUSDC = 0x571c992873D31310B11Bf6bF6B44f2748B4bce8C;
    uint256 internal constant DEPOSIT = 100e6;
    address internal constant HOUSE = 0x79bC47e448b1B52F3DE651a0d102FD73FaDD7B7C;
    uint256 internal constant GRANT =
        RegistryRolesLib.ROLE_REGISTRAR | RegistryRolesLib.ROLE_RENEW | RegistryRolesLib.ROLE_UNREGISTER;

    bytes32 internal constant STORE_SALT = keccak256("rival.ens.mock-label-store.v1");
    bytes32 internal constant ENS_SALT = keccak256("rival.ens.permissioned-registry.v1");
    bytes32 internal constant FACTORY_SALT = keccak256("rival.ens.pair-factory.v1");

    error GrantBitmap();
    error MissingCreate2Deployer();
    error MissingToken(address token);
    error SenderMismatch(address actual, address expected);
    error AddressMismatch(address predicted, address actual);
    error AlreadyDeployed(address deployed);
    error Wiring();
    error RoleBitmap(uint256 actual);

    function run() external {
        if (GRANT != 0x11001) revert GrantBitmap();

        address operator = vm.addr(vm.envUint("OPERATOR_PRIVATE_KEY"));
        if (CREATE2_DEPLOYER.code.length == 0) revert MissingCreate2Deployer();
        if (TUSDC.code.length == 0) revert MissingToken(TUSDC);

        address store = vm.computeCreate2Address(STORE_SALT, keccak256(type(MockLabelStore).creationCode), CREATE2_DEPLOYER);
        address ensPredicted = vm.computeCreate2Address(
            ENS_SALT,
            keccak256(
                abi.encodePacked(
                    type(PermissionedRegistry).creationCode, abi.encode(store, operator, EACBaseRolesLib.ALL_ROLES)
                )
            ),
            CREATE2_DEPLOYER
        );
        address factory =
            vm.computeCreate2Address(FACTORY_SALT, keccak256(type(EnsPairFactory).creationCode), CREATE2_DEPLOYER);
        // A contract's nonce starts at 1. The factory constructor creates nothing.
        address names = vm.computeCreateAddress(factory, 1);
        address registry = vm.computeCreateAddress(factory, 2);

        if (store.code.length != 0) revert AlreadyDeployed(store);
        if (ensPredicted.code.length != 0) revert AlreadyDeployed(ensPredicted);
        if (factory.code.length != 0) revert AlreadyDeployed(factory);
        if (names.code.length != 0) revert AlreadyDeployed(names);
        if (registry.code.length != 0) revert AlreadyDeployed(registry);

        vm.startBroadcast();
        if (msg.sender != operator) revert SenderMismatch(msg.sender, operator);

        MockLabelStore deployedStore = new MockLabelStore{salt: STORE_SALT}();
        if (address(deployedStore) != store) revert AddressMismatch(store, address(deployedStore));

        PermissionedRegistry ens =
            new PermissionedRegistry{salt: ENS_SALT}(ILabelStore(store), operator, EACBaseRolesLib.ALL_ROLES);
        if (address(ens) != ensPredicted) revert AddressMismatch(ensPredicted, address(ens));

        EnsPairFactory deployedFactory = new EnsPairFactory{salt: FACTORY_SALT}();
        if (address(deployedFactory) != factory) revert AddressMismatch(factory, address(deployedFactory));

        deployedFactory.deploy(names, registry, IStandardRegistry(address(ens)), TUSDC, DEPOSIT, HOUSE);
        ens.grantRootRoles(GRANT, names);
        vm.stopBroadcast();

        if (RivalNames(names).registry() != registry) revert Wiring();
        if (address(RivalNames(names).ens()) != address(ens)) revert Wiring();
        if (RivalNames(names).resolver() != address(0)) revert Wiring();
        if (address(SolverRegistry(registry).names()) != names) revert Wiring();
        if (SolverRegistry(registry).depositToken() != TUSDC) revert Wiring();
        if (SolverRegistry(registry).depositAmount() != DEPOSIT) revert Wiring();
        if (SolverRegistry(registry).house() != HOUSE) revert Wiring();
        if (ens.roles(0, names) != GRANT) revert RoleBitmap(ens.roles(0, names));
        if (!ens.hasRootRoles(GRANT, names)) revert RoleBitmap(ens.roles(0, names));

        console2.log(string.concat("ENS_STORE ", vm.toString(store)));
        console2.log(string.concat("ENS_REGISTRY ", vm.toString(address(ens))));
        console2.log(string.concat("ENS_NAMES ", vm.toString(names)));
        console2.log(string.concat("ENS_SOLVER_REGISTRY ", vm.toString(registry)));
        console2.log(string.concat("ENS_FACTORY ", vm.toString(factory)));
        console2.log(string.concat("ENS_OPERATOR ", vm.toString(operator)));
        console2.log(string.concat("ENS_ROLES ", vm.toString(ens.roles(0, names))));
        console2.log(string.concat("ENS_DEPOSIT ", vm.toString(DEPOSIT)));
    }
}
