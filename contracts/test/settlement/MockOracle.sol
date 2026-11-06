// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

import {IRivalOracle} from "../../src/interfaces/IRivalOracle.sol";
import {InsufficientHistory, WindowOutOfRange} from "../../src/Types.sol";

/// @notice Quote stub. `echo` returns 111 or 222 so tests can see `zeroForOne`.
contract MockOracle is IRivalOracle {
    uint256 public quoteOut = 3_000_000_000;
    bool public insufficient;
    bool public boom;
    bool public echo;

    function setQuote(uint256 amount) external {
        quoteOut = amount;
    }

    function setInsufficient(bool value) external {
        insufficient = value;
    }

    function setBoom(bool value) external {
        boom = value;
    }

    function setEcho(bool value) external {
        echo = value;
    }

    function consult(PoolKey calldata, uint32) external pure returns (int24) {
        return 0;
    }

    function quote(PoolKey calldata, bool zeroForOne, uint128, uint32) external view returns (uint256) {
        if (insufficient) revert InsufficientHistory();
        if (boom) revert WindowOutOfRange();
        if (echo) return zeroForOne ? 111 : 222;
        return quoteOut;
    }

    function oldestTimestamp(PoolId) external pure returns (uint32) {
        return 0;
    }
}
