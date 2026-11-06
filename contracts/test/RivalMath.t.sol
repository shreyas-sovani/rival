// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {RivalMath} from "../src/libs/RivalMath.sol";

/// @notice Every row in `packages/intent/vectors.jsonl` must match {RivalMath}.
/// @dev One JSON object per line. The whole file is too large to hold in the EVM.
contract RivalMathTest is Test {
    string internal constant PATH = "../packages/intent/vectors.json";

    function test_vectorsMatchTypescript() public {
        uint256 n;
        while (true) {
            string memory line = vm.readLine(PATH);
            if (bytes(line).length == 0) break;
            this.checkLine(line);
            unchecked {
                n++;
            }
        }
        vm.closeFile(PATH);
        assertGe(n, 10_008);
    }

    function checkLine(string calldata line) external pure {
        RivalMath.CurveInput memory input;
        input.mode = uint8(vm.parseJsonUint(line, ".mode"));
        input.baseOut = _uint(line, ".baseOut");
        input.quoteOut = _uint(line, ".quoteOut");
        input.startBps = int32(vm.parseJsonInt(line, ".startBps"));
        input.floorBps = int32(vm.parseJsonInt(line, ".floorBps"));
        input.startTime = uint32(vm.parseJsonUint(line, ".startTime"));
        input.decaySecs = uint32(vm.parseJsonUint(line, ".decaySecs"));
        input.hardMinOut = _uint(line, ".hardMinOut");
        input.ts = vm.parseJsonUint(line, ".ts");

        (uint256 required, int256 curveBps, uint256 base, uint256 curveOut, uint32 elapsed) =
            RivalMath.requiredAt(input);

        assertEq(required, _uint(line, ".required"));
        assertEq(curveBps, vm.parseJsonInt(line, ".curveBps"));
        assertEq(base, _uint(line, ".base"));
        assertEq(curveOut, _uint(line, ".curveOut"));
        assertEq(uint256(elapsed), vm.parseJsonUint(line, ".elapsed"));
        assertGe(required, input.hardMinOut);

        (uint256 fairAfter, int256 improvement) =
            RivalMath.receipt(required, _uint(line, ".fairOut"), vm.parseJsonUint(line, ".poolFee"));
        assertEq(fairAfter, _uint(line, ".fairOutAfterFee"));
        assertEq(improvement, vm.parseJsonInt(line, ".improvementBps"));
    }

    function _uint(string memory line, string memory key) internal pure returns (uint256) {
        return vm.parseUint(vm.parseJsonString(line, key));
    }
}
