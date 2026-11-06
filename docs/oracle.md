# Block-start oracle

`RivalOracleHook` is the Uniswap v4 hook behind `IRivalOracle`. Each pool keeps a ring of 256 observations:

```
struct Observation { uint32 ts; int56 tickCumulative; int24 blockStartTick; }
```

`afterInitialize` seeds slot 0 at `block.timestamp` with cumulative 0 and `blockStartTick = initialTick`. `beforeSwap` writes at most one observation per timestamp. The tick stored on that write is the pool tick **before** the swap. The segment from observation `o1` to the next observation `o2` is priced at `o2.blockStartTick`. `consult` rounds the mean toward negative infinity. `quote` is the Uniswap v3 `OracleLibrary.getQuoteAtTick` mid amount at that mean tick: fees and price impact are not applied.

The TypeScript twin is `packages/intent/src/oracle-model.ts`. Foundry replays `packages/intent/oracle-vectors.jsonl` (1,000 lines, `vm.readLine`) in `test_modelParity`.

## Properties

| Property | What it means | Foundry test |
| --- | --- | --- |
| (i) Same-block manipulation cannot move `consult` | A swap that shifts the tick by about 10% inside the current timestamp leaves `consult` unchanged (0 bps) | `test_sameBlockManipulationZero` |
| (ii) A manipulation that lasts `d` seconds moves the TWAP by at most `(d/W)·Δ` | Holding a new tick for `k` blocks changes the window-`W` mean by at most that fraction, with 1 tick of slack for floor division | `test_manipulationBounded` |
| (iii) `beforeSwap` never reverts | Extreme ticks, zero liquidity, and a direct `PoolManager` swap still return the hook selector. A non-manager caller reverting `NotPoolManager` is expected. The write itself runs in `recordObservation` under `try/catch` | `test_beforeSwapNeverReverts` |
| (iv) Liquidity changes are ignored | Adding and removing liquidity does not change `consult` | `test_liquidityIgnored` |
| (v) A stale oracle fails closed for PEGGED intents | `consult` / `quote` revert `InsufficientHistory` when the ring does not cover the window (and `WindowOutOfRange` outside `[60, 3600]`). Settlement maps that failure to `OracleUnavailable`; this hook does not catch it | `test_staleFailsClosed` |

`oldestTimestamp` is 0 when the pool has no observations. An uninitialized pool is `InsufficientHistory`, the same error as a window the ring does not cover.

## Sepolia venue

Pool A `0xd302ad11d027e1897d14162ac1d7a583a7c48a12a547a25c12c9bb1da504f13f`. Pool B `0xc990bf9d3e98afd98afafdad812369a1b8dd6822622f49cf9f7a312701c0549b`. Hook `0xb17a547082836fDF87001c1DE031fA8A2D391080`. Flag mask `0x1080`.

`deployments/sepolia.json` leaves settlement, registry, names, and the ENS addresses (`ethRegistrar`, `ethRegistry`, `rootRegistry`, `userRegistryImpl`, `verifiableFactory`, `permissionedResolverImpl`, `universalResolverV2`, `universalResolverProxy`, `solversRegistry`) at the zero address. `uniswapSolvers`, `solvers`, and `arkivWriterAddresses` are empty. Those values are placeholders. They were not deployed.
