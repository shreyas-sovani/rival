// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {TestToken} from "../../src/tokens/TestToken.sol";
import {RivalOracleHook} from "../../src/hook/RivalOracleHook.sol";

/// @notice Canonical Uniswap v4 PoolManager on Ethereum Sepolia.
///         https://developers.uniswap.org/docs/protocols/v4/deployments
contract RivalOracleHookForkTest is Test {
    address internal constant SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    uint160 internal constant FLAGS = Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG;

    /// @dev Routers refund leftover ETH. On a fork their CREATE address can already hold a balance.
    receive() external payable {}

    function test_fork_initializeHookedPool() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true, "SEPOLIA_RPC_URL is unset; Sepolia fork skipped");
            return;
        }

        vm.createSelectFork("sepolia");
        IPoolManager manager = IPoolManager(SEPOLIA_POOL_MANAGER);
        assertGt(address(manager).code.length, 0, "canonical PoolManager has no code");

        (address predicted, bytes32 salt) =
            HookMiner.find(address(this), FLAGS, type(RivalOracleHook).creationCode, abi.encode(manager));
        RivalOracleHook hook = new RivalOracleHook{salt: salt}(manager);
        assertEq(address(hook), predicted);
        assertEq(uint160(address(hook)) & Hooks.ALL_HOOK_MASK, FLAGS);

        TestToken a = new TestToken("Rival A", "rA", 18, address(this));
        TestToken b = new TestToken("Rival B", "rB", 18, address(this));
        (TestToken token0, TestToken token1) = address(a) < address(b) ? (a, b) : (b, a);
        token0.mint(address(this), 1_000_000 ether);
        token1.mint(address(this), 1_000_000 ether);

        PoolSwapTest swapRouter = new PoolSwapTest(manager);
        PoolModifyLiquidityTest liquidityRouter = new PoolModifyLiquidityTest(manager);
        token0.approve(address(swapRouter), type(uint256).max);
        token1.approve(address(swapRouter), type(uint256).max);
        token0.approve(address(liquidityRouter), type(uint256).max);
        token1.approve(address(liquidityRouter), type(uint256).max);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 500,
            tickSpacing: 10,
            hooks: IHooks(address(hook))
        });
        int24 tick = manager.initialize(key, TickMath.getSqrtPriceAtTick(0));
        assertEq(tick, 0);
        assertEq(hook.oldestTimestamp(key.toId()), uint32(block.timestamp));

        liquidityRouter.modifyLiquidity(
            key, ModifyLiquidityParams({tickLower: -120, tickUpper: 120, liquidityDelta: 1e18, salt: 0}), ""
        );

        BalanceDelta delta = swapRouter.swap(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -1e15, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
        assertLt(delta.amount0(), 0);
        assertGt(delta.amount1(), 0);
    }
}
