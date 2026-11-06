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

## Settlement

The venue section above left settlement at the zero address. That placeholder is superseded by this deploy. RivalSettlement `0xdD66D017e4B4FfF51aBEf2f559C68065D4FD9850` and UniswapSolver `0xDBe8a61e1A4cDd767FfA7C822C242B8E85414e17` are on Sepolia. SolverRegistry `0x6AD5C78fA2278d397Bb7e04e1e2266Cc39a1109E` accepted `setSettlement` in the settlement creation transaction, and `settlementLocked` is true. Pair config is pool A: currency0 `0x45E6a5bD3be4D00E7Be57287D7d25De3F833253d`, currency1 `0x571c992873D31310B11Bf6bF6B44f2748B4bce8C`, fee 500, tick spacing 10, hook `0xb17a547082836fDF87001c1DE031fA8A2D391080`. Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`. PoolManager `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`. RivalSettlement links RivalMath at `0x99596AB09a231A1Da8f1e7B0a42e78dE1EB6EcC9`. The solver owner is the operator `0xFeAf5C921996FC53f4DEf35e181E766e6D74690A`. Solver names were not registered in this pass.
