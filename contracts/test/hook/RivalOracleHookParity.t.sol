// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {RivalOracleHook} from "../../src/hook/RivalOracleHook.sol";

/// @notice Replays `packages/intent/oracle-vectors.jsonl` one line at a time.
contract RivalOracleHookParityTest is Test {
    using stdJson for string;
    using StateLibrary for IPoolManager;

    string internal constant VECTORS = "../packages/intent/oracle-vectors.jsonl";
    uint160 internal constant FLAGS = Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG;

    IPoolManager internal manager;
    RivalOracleHook internal hook;

    function setUp() public {
        manager = new PoolManager(address(this));
        (address predicted, bytes32 salt) =
            HookMiner.find(address(this), FLAGS, type(RivalOracleHook).creationCode, abi.encode(manager));
        hook = new RivalOracleHook{salt: salt}(manager);
        assertEq(address(hook), predicted);
    }

    function test_modelParity() public {
        for (uint256 i = 0; i < 1000; i++) {
            string memory line = vm.readLine(VECTORS);
            assertGt(bytes(line).length, 0, "short vector file");
            this.replayLine(line, i);
        }
    }

    function replayLine(string calldata line, uint256 i) external {
        assertEq(msg.sender, address(this));
        uint32 t0 = uint32(uint256(line.readUint(".t0")));
        int24 tick0 = int24(line.readInt(".tick0"));
        uint32 tail = uint32(uint256(line.readUint(".tail")));
        PoolKey memory key = _initPool(i, t0, tick0);
        _applySwaps(line, key, t0, tail);
        _assertConsult(line, i, key);
        _assertRing(line, i, key.toId());
    }

    function _initPool(uint256 i, uint32 t0, int24 tick0) internal returns (PoolKey memory key) {
        vm.warp(t0);
        key = PoolKey({
            currency0: Currency.wrap(address(0xB0B)),
            currency1: Currency.wrap(address(0xA11CE)),
            fee: uint24(i + 1),
            tickSpacing: 10,
            hooks: IHooks(address(hook))
        });
        int24 opened = manager.initialize(key, TickMath.getSqrtPriceAtTick(tick0));
        assertEq(opened, tick0, "init tick");
    }

    function _applySwaps(string calldata line, PoolKey memory key, uint32 t0, uint32 tail) internal {
        int256[] memory dts = line.readIntArray(".dt");
        int256[] memory afterTicks = line.readIntArray(".after");
        assertEq(dts.length, afterTicks.length);
        PoolId id = key.toId();
        uint32 nowTs = t0;
        for (uint256 n = 0; n < dts.length; n++) {
            nowTs += uint32(uint256(dts[n]));
            vm.warp(nowTs);
            vm.prank(address(manager));
            (bytes4 sel,,) = hook.beforeSwap(
                address(this),
                key,
                SwapParams({zeroForOne: true, amountSpecified: -1, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
                ""
            );
            assertEq(sel, IHooks.beforeSwap.selector);
            _writeTick(id, int24(afterTicks[n]));
        }
        vm.warp(nowTs + tail);
    }

    function _assertConsult(string calldata line, uint256, PoolKey memory key) internal view {
        uint32 window = uint32(uint256(line.readUint(".window")));
        assertEq(int256(hook.consult(key, window)), line.readInt(".avg"), "consult");
    }

    function _assertRing(string calldata line, uint256, PoolId id) internal view {
        (uint16 index, uint16 card) = hook.ringState(id);
        assertEq(index, uint16(uint256(line.readUint(".index"))), "index");
        assertEq(card, uint16(uint256(line.readUint(".card"))), "card");
        _assertColumn(line, id, index, card, 0);
        _assertColumn(line, id, index, card, 1);
        _assertColumn(line, id, index, card, 2);
    }

    /// @dev kind 0 = timestamp, 1 = cumulative, 2 = block-start tick. One array at a time.
    function _assertColumn(string calldata line, PoolId id, uint16 index, uint16 card, uint8 kind) internal view {
        int256[] memory values = line.readIntArray(kind == 0 ? ".ts" : kind == 1 ? ".cum" : ".bst");
        assertEq(values.length, card);
        uint16 start = (index + 1) % card;
        for (uint16 n = 0; n < card; n++) {
            uint16 slot = uint16((uint256(start) + n) % card);
            (uint32 obsTs, int56 obsCum, int24 obsBst) = hook.observation(id, slot);
            int256 got = kind == 0 ? int256(uint256(obsTs)) : kind == 1 ? int256(obsCum) : int256(obsBst);
            assertEq(got, values[n]);
        }
    }

    function _writeTick(PoolId id, int24 tick) internal {
        bytes32 slot = keccak256(abi.encodePacked(PoolId.unwrap(id), bytes32(uint256(6))));
        bytes32 raw = vm.load(address(manager), slot);
        bytes32 updated;
        assembly ("memory-safe") {
            let cleared := and(raw, not(shl(160, 0xFFFFFF)))
            updated := or(cleared, shl(160, and(tick, 0xFFFFFF)))
        }
        vm.store(address(manager), slot, updated);
    }
}
