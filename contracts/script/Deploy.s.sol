// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

import {IPermit2Min} from "../src/interfaces/IPermit2Min.sol";
import {IRivalOracle} from "../src/interfaces/IRivalOracle.sol";
import {ISolverRegistry} from "../src/interfaces/ISolverRegistry.sol";
import {RivalSettlement} from "../src/RivalSettlement.sol";
import {SolverRegistry} from "../src/SolverRegistry.sol";
import {UniswapSolver} from "../src/solver/UniswapSolver.sol";

/// @notice Creates RivalSettlement, binds it, and creates UniswapSolver in one transaction.
/// @dev `setSettlement` has no caller check. A separate transaction would let another account bind first.
contract SettlementDeployer {
    struct Args {
        address permit2;
        address oracle;
        address registry;
        address currency0;
        address currency1;
        address hooks;
        address poolManager;
        address owner;
    }

    event Bound(address settlement, address solver);

    function deploy(Args memory args) external returns (address settlement, address solver) {
        RivalSettlement deployedSettlement = new RivalSettlement(
            IPermit2Min(args.permit2),
            IRivalOracle(args.oracle),
            ISolverRegistry(args.registry),
            _pair(args)
        );
        ISolverRegistry(args.registry).setSettlement(address(deployedSettlement));
        UniswapSolver deployedSolver =
            new UniswapSolver(address(deployedSettlement), IPoolManager(args.poolManager), args.owner);
        settlement = address(deployedSettlement);
        solver = address(deployedSolver);
        emit Bound(settlement, solver);
    }

    function _pair(Args memory args) private pure returns (RivalSettlement.PairConfig memory pair) {
        pair.key = PoolKey({
            currency0: Currency.wrap(args.currency0),
            currency1: Currency.wrap(args.currency1),
            fee: 500,
            tickSpacing: 10,
            hooks: IHooks(args.hooks)
        });
    }
}

/// @notice Sepolia RivalSettlement and one UniswapSolver. Does not deploy tokens, the hook, pools, or names.
contract Deploy is Script {
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address internal constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;

    error AddressMismatch(address actual, address expected);
    error AlreadyBound(address settlement);
    error CodeMissing(address target);
    error SenderMismatch(address actual, address expected);
    error Wiring();

    address internal operator;
    address internal oracle;
    address internal registry;
    address internal currency0;
    address internal currency1;
    address internal hooks;
    address internal settlement;
    address internal solver;

    function run() external {
        _load();
        _requireInputs();
        _broadcast();
        _requireWiring();
        _log();
    }

    function _load() internal {
        operator = vm.addr(vm.envUint("OPERATOR_PRIVATE_KEY"));
        oracle = vm.envAddress("ORACLE");
        registry = vm.envAddress("REGISTRY");
        currency0 = vm.envAddress("CURRENCY0");
        currency1 = vm.envAddress("CURRENCY1");
        hooks = vm.envAddress("HOOKS");
    }

    function _requireInputs() internal view {
        if (vm.envAddress("PERMIT2") != PERMIT2) revert AddressMismatch(vm.envAddress("PERMIT2"), PERMIT2);
        if (vm.envAddress("POOL_MANAGER") != POOL_MANAGER) revert AddressMismatch(vm.envAddress("POOL_MANAGER"), POOL_MANAGER);
        if (hooks != oracle) revert AddressMismatch(hooks, oracle);
        if (currency0 == address(0) || currency1 == address(0) || currency0 >= currency1) revert Wiring();
        if (PERMIT2.code.length == 0) revert CodeMissing(PERMIT2);
        if (oracle.code.length == 0) revert CodeMissing(oracle);
        if (registry.code.length == 0) revert CodeMissing(registry);
        if (POOL_MANAGER.code.length == 0) revert CodeMissing(POOL_MANAGER);
        if (currency0.code.length == 0) revert CodeMissing(currency0);
        if (currency1.code.length == 0) revert CodeMissing(currency1);
        SolverRegistry reg = SolverRegistry(registry);
        if (reg.settlementLocked() || reg.settlement() != address(0)) revert AlreadyBound(reg.settlement());
    }

    function _broadcast() internal {
        vm.startBroadcast();
        if (msg.sender != operator) revert SenderMismatch(msg.sender, operator);
        SettlementDeployer deployer = new SettlementDeployer();
        (settlement, solver) = deployer.deploy(
            SettlementDeployer.Args({
                permit2: PERMIT2,
                oracle: oracle,
                registry: registry,
                currency0: currency0,
                currency1: currency1,
                hooks: hooks,
                poolManager: POOL_MANAGER,
                owner: operator
            })
        );
        vm.stopBroadcast();
    }

    function _requireWiring() internal view {
        RivalSettlement deployed = RivalSettlement(settlement);
        UniswapSolver deployedSolver = UniswapSolver(solver);
        SolverRegistry reg = SolverRegistry(registry);
        if (address(deployed.permit2()) != PERMIT2) revert Wiring();
        if (address(deployed.oracle()) != oracle) revert Wiring();
        if (address(deployed.registry()) != registry) revert Wiring();
        if (deployed.currency0() != currency0 || deployed.currency1() != currency1) revert Wiring();
        if (deployed.poolFee() != 500 || deployed.tickSpacing() != 10 || deployed.hooks() != hooks) revert Wiring();
        if (reg.settlement() != settlement || !reg.settlementLocked()) revert Wiring();
        if (deployedSolver.settlement() != settlement) revert Wiring();
        if (address(deployedSolver.poolManager()) != POOL_MANAGER || deployedSolver.owner() != operator) revert Wiring();
    }

    function _log() internal view {
        console2.log(string.concat("DEPLOY_SETTLEMENT ", vm.toString(settlement)));
        console2.log(string.concat("DEPLOY_SOLVER ", vm.toString(solver)));
        console2.log(string.concat("DEPLOY_OPERATOR ", vm.toString(operator)));
        console2.log(string.concat("DEPLOY_LOCKED ", SolverRegistry(registry).settlementLocked() ? "1" : "0"));
    }
}
