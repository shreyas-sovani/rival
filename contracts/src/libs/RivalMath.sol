// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title RivalMath
/// @notice Curve and receipt math from PRD §7.2. Must match `packages/intent` on every vector.
/// @dev `floorDiv` rounds toward negative infinity. `ceilDiv` rounds toward positive infinity.
///      Improvement division truncates toward zero (Solidity's signed `/`).
library RivalMath {
    /// @notice Oracle-unavailable improvement sentinel. Not counted in solver stats.
    int256 internal constant IMPROVEMENT_SENTINEL = type(int32).min;

    /// @dev Reverts when `d` is zero. The remainder sign follows the dividend, matching Solidity.
    function floorDiv(int256 n, int256 d) internal pure returns (int256 q) {
        require(d != 0, "division by zero");
        q = n / d;
        if (n % d != 0 && ((n < 0) != (d < 0))) {
            unchecked {
                q -= 1;
            }
        }
    }

    /// @dev `n` and `d` are non-negative. Reverts when `d` is zero.
    function ceilDiv(uint256 n, uint256 d) internal pure returns (uint256) {
        require(d != 0, "division by zero");
        if (n == 0) return 0;
        return (n - 1) / d + 1;
    }

    /// @notice Inputs for one curve evaluation. One memory struct keeps the vector test under the stack limit.
    struct CurveInput {
        uint8 mode;
        uint256 baseOut;
        uint256 quoteOut;
        int32 startBps;
        int32 floorBps;
        uint32 startTime;
        uint32 decaySecs;
        uint256 hardMinOut;
        uint256 ts;
    }

    /// @notice Required output at `input.ts`. `mode` 0 uses `baseOut`, mode 1 uses `quoteOut`.
    /// @return required max(curveOut, hardMinOut)
    /// @return curveBps Signed premium after decay.
    /// @return base The reference output the curve multiplies.
    /// @return curveOut Output before the hard floor.
    /// @return elapsed Seconds of decay applied.
    /// @dev Public so the call is its own frame. An internal library function is inlined.
    function requiredAt(CurveInput memory input)
        public
        pure
        returns (uint256 required, int256 curveBps, uint256 base, uint256 curveOut, uint32 elapsed)
    {
        require(input.decaySecs != 0, "BadParams");
        base = input.mode == 1 ? input.quoteOut : input.baseOut;
        if (input.ts <= input.startTime) {
            elapsed = 0;
        } else if (input.ts - input.startTime >= input.decaySecs) {
            elapsed = input.decaySecs;
        } else {
            elapsed = uint32(input.ts - input.startTime);
        }
        int256 span = int256(input.startBps) - int256(input.floorBps);
        int256 decayed = floorDiv(span * int256(uint256(elapsed)), int256(uint256(input.decaySecs)));
        curveBps = int256(input.startBps) - decayed;
        uint256 multiplier = uint256(10_000 + curveBps);
        curveOut = ceilDiv(base * multiplier, 10_000);
        required = curveOut > input.hardMinOut ? curveOut : input.hardMinOut;
    }

    /// @notice Receipt fields. `fairOut == 0` yields the sentinel and a zero fee-adjusted reference.
    /// @dev Public for the same reason as {requiredAt}.
    function receipt(uint256 amountOut, uint256 fairOut, uint256 poolFee)
        public
        pure
        returns (uint256 fairOutAfterFee, int256 improvementBps)
    {
        if (fairOut == 0 || poolFee > 1_000_000) {
            return (0, IMPROVEMENT_SENTINEL);
        }
        fairOutAfterFee = fairOut * (1_000_000 - poolFee) / 1_000_000;
        if (fairOutAfterFee == 0) {
            return (0, IMPROVEMENT_SENTINEL);
        }
        int256 raw = (int256(amountOut) - int256(fairOutAfterFee)) * 10_000 / int256(fairOutAfterFee);
        if (raw > 10_000) raw = 10_000;
        if (raw < -10_000) raw = -10_000;
        improvementBps = raw;
    }
}
