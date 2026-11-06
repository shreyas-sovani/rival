# Intent math and Permit2 witness

Normative source: PRD §7.2 and §7.1. The TypeScript twin is `packages/intent`. The Solidity twin is `contracts/src/libs/RivalMath.sol`. They are checked against the same file, `packages/intent/vectors.json`. That file is one JSON object per line (10,000 random rows plus the worked example and the edge cases) so Foundry can read it with `vm.readLine`. A single JSON document of this size does not fit in the EVM.

## Curve

```
base      = mode == PEGGED ? quoteOut : baseOut
elapsed   = clamp(ts - startTime, 0, decaySecs)
bps       = startBps - floorDiv((startBps - floorBps) * elapsed, decaySecs)
curveOut  = ceilDiv(base * (10_000 + bps), 10_000)
required  = max(curveOut, hardMinOut)
```

`floorDiv` rounds toward negative infinity. On this curve the numerator is non-negative (`startBps >= floorBps`), so it matches truncation toward zero. `ceilDiv` rounds toward positive infinity, which raises the required output. That favors the maker.

Presets (FR-WEB-02):

| Preset | Decay | Start bps | Floor bps | Hard floor | Deadline |
| --- | ---: | ---: | ---: | --- | --- |
| Fast | 30 s | +10 | −20 | 98.5% of the quote | start + decay + 60 s |
| Balanced | 90 s | +20 | −30 | 98.5% of the quote | start + decay + 60 s |
| Patient | 240 s | +40 | −50 | 98.5% of the quote | start + decay + 60 s |

## Worked example

Sell 1 tWETH. Pegged. Mid quote `3_000_000_000` (3,000 tUSDC at 6 decimals). `startBps = +20`, `floorBps = −30`, `decaySecs = 90`, pool fee 500, hard floor `2_955_000_000`.

| Elapsed | bps | Required | Fee-adjusted fair | Improvement |
| --- | ---: | ---: | ---: | ---: |
| 0 s | +20 | 3,006.000000 | 2,998.500000 | +25 |
| 18 s | +10 | 3,003.000000 | 2,998.500000 | +15 |
| 45 s | −5 | 2,998.500000 | 2,998.500000 | 0 |
| 90 s | −30 | 2,991.000000 | 2,998.500000 | −25 |

`bps(45) = 20 - floorDiv(50 * 45, 90) = -5`.

## Receipt

```
fairAfter = fairOut * (1_000_000 - poolFee) / 1_000_000
improvementBps = clamp(truncDiv((amountOut - fairAfter) * 10_000, fairAfter), -10_000, 10_000)
```

`truncDiv` rounds toward zero. If `fairOut` is 0, or the fee-adjusted value is 0, `improvementBps` is `type(int32).min` (`-2147483648`). Stats ignore that sentinel.

## EIP-712 witness

`hashIntent` is the EIP-712 struct hash of `Intent`. It is not a signing digest. Permit2 binds the spender (the settlement contract) inside its own domain (`name = Permit2`, no version field).

The type string, which is also the comment in `contracts/src/Types.sol`:

```
Intent(address maker,address tokenIn,address tokenOut,uint128 amountIn,address recipient,uint8 mode,uint128 baseOut,uint32 oracleWindow,int32 startBps,int32 floorBps,uint32 startTime,uint32 decaySecs,uint32 deadline,uint128 hardMinOut,uint8 gate,bytes32 allowlistHash,uint256 nonce)
```

Enum fields are `uint8`. The witness suffix passed to `permitWitnessTransferFrom` is that definition with `Intent witness)` in front and `TokenPermissions(address token,uint256 amount)` after it. The digest matches `@uniswap/permit2-sdk@1.4.1` `SignatureTransfer.hash`.

Named-gate `allowlistHash` is `keccak256(abi.encodePacked(labelhashes))`. Other gates store `bytes32(0)`.
