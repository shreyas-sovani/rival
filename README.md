# Judge quick-start

1. Read `deployments/sepolia.json` and `docs/demo.md`. The chain is Sepolia (`11155111`). The production site is https://rival-flame.vercel.app (H-008). The runner is https://rival-runner.fly.dev in the Fly org `personal`. `runnerUrl` in the deployment file is that host. CORS allows the site origin. `/api/health` is `degraded` because the house holds no tWETH or tUSDC and the open book is empty. On 2026-11-07 the oracle age was 70s with 48 observations, Arkiv was up, and the market maker, atlas, and house were heartbeating. The one-hour soak has not been run. The Vercel site is still the previous build.
2. The one absolute fill hash is in `docs/demo.md`: `0xeadff32d9c91c28bab2c9dc8136c7d1a2ef2c0091085f1a0e2d891645e9500ec` on RivalSettlement `0xdD66D017e4B4FfF51aBEf2f559C68065D4FD9850`. `atlas` (`0xD2aA21AF4faa840Dea890DB2C6649AACF2C80Ff3`) is the only registered solver. `rival.eth` is owned by the operator on the Sepolia ETHRegistry. `solvers.rival.eth` does not resolve yet.
3. The Arkiv query below is the one that returned a row on 2026-11-06. That entity has expired. A later run can return no rows. Contract tests from this repo: `pnpm forge:test`.

# Architecture

Diagrams: `docs/architecture.md` (PRD §6.1–§6.5, copied verbatim).

Sepolia addresses from `deployments/sepolia.json`, `docs/oracle.md`, `docs/ens-design.md`, and `docs/demo.md`:

| Piece | Address |
| --- | --- |
| tWETH | `0x45E6a5bD3be4D00E7Be57287D7d25De3F833253d` |
| tUSDC | `0x571c992873D31310B11Bf6bF6B44f2748B4bce8C` |
| RivalOracleHook | `0xb17a547082836fDF87001c1DE031fA8A2D391080` |
| Pool A | `0xd302ad11d027e1897d14162ac1d7a583a7c48a12a547a25c12c9bb1da504f13f` |
| Pool B | `0xc990bf9d3e98afd98afafdad812369a1b8dd6822622f49cf9f7a312701c0549b` |
| RivalSettlement | `0xdD66D017e4B4FfF51aBEf2f559C68065D4FD9850` |
| UniswapSolver | `0xDBe8a61e1A4cDd767FfA7C822C242B8E85414e17` |
| SolverRegistry | `0x6AD5C78fA2278d397Bb7e04e1e2266Cc39a1109E` |
| RivalNames | `0xC20a61e830bB91A69C1B6BCcd607299152aDE797` |
| Solvers PermissionedRegistry | `0xCEec9D7ADcad00e4D842283d9526E75C9440b36f` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| PoolManager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` |
| Solver `atlas` | `0xD2aA21AF4faa840Dea890DB2C6649AACF2C80Ff3` |

The canonical ENS fields in `deployments/sepolia.json` (`ethRegistrar`, `ethRegistry`, `rootRegistry`, `userRegistryImpl`, `verifiableFactory`, `permissionedResolverImpl`, `universalResolverV2`, `universalResolverProxy`) are the zero address. `arkivWriterAddresses` is an empty array.

# Uniswap integration line map

Line numbers are from the files in this checkout. `v4-core` is BUSL-1.1. These Rival contracts are MIT and call it. They do not relicense `v4-core`.

| Uniswap component | File | Lines | What it does |
| --- | --- | --- | --- |
| v4 hook (beforeSwap/afterInitialize) | `contracts/src/hook/RivalOracleHook.sol` | `getHookPermissions` 48–65, `_afterInitialize` 155–165, `_beforeSwap` 167–174, `recordObservation` 124–153 | Permissions are `afterInitialize` and `beforeSwap` only. The deployed flag mask is `0x1080`. `afterInitialize` seeds ring slot 0. `beforeSwap` writes at most one observation per timestamp inside `try/catch` and returns the hook selector with a zero delta. |
| consult/quote | `contracts/src/hook/RivalOracleHook.sol` | `consult` 68–86, `quote` 89–96, `_quoteAtTick` 231–244 | `consult` is the mean tick over a window of 60 to 3600 seconds, rounded toward negative infinity. `quote` is the mid amount at that tick. Fees and price impact are not applied. Pool A `consult(60)` returned tick `-196257` (`docs/demo.md`). |
| Permit2 permitWitnessTransferFrom | `contracts/src/RivalSettlement.sol` | `fill` 132–139, `_pullAndDeliver` 278–289 | `fill` prices the intent, then `permitWitnessTransferFrom` pulls `amountIn` to `p.inputTo`. The witness is the intent hash. The type string is `WITNESS_TYPE_STRING` at lines 47–48. |
| PoolManager unlock/swap/take | `contracts/src/solver/UniswapSolver.sol` | `rivalFillCallback` 57–83, `unlockCallback` 86–90, `_swap` 97–118, `_pay` 120–124 | The settlement callback unlocks the pool, swaps, `sync`s and `settle`s the input, and `take`s the output. The absolute fill `0xeadff32d9c91c28bab2c9dc8136c7d1a2ef2c0091085f1a0e2d891645e9500ec` ran this path: `msg.sender` is `atlas`, delegated to this solver. |
| Quoter/StateView reads | `scripts/pools-deploy.ts` | `readSlot0` 124–140, `quote` 142–158 | Off-chain `eth_call`s to StateView `0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C` `getSlot0` and V4Quoter `0x68aFa8b853cAa7a2D40B0F6AEE5C4DbC147C8244` `quoteExactInputSingle`. `contracts/script/DeployVenue.s.sol` `_checkSlot0` is lines 236–239. `scripts/demo-live.ts` calls the same quoter at lines 669–679. That call reverted. `docs/demo.md` records the floor that was used: hard floor `1799099` tUSDC base units. `packages/solver-sdk/src/quote.ts` `quoteCost` (lines 12–19) converts gas into token units. `packages/solver-sdk/src/run.ts` lines 94–108 call a `VenueQuoter` port. |

# ENS

`rival.eth` is registered to the operator. Register transaction: `0x1d9740fccaa1506b12584e4e23c49ecdb92e96293d904b7d7d195a942c4679f6`. `getOwner(keccak256("rival"))` on ETHRegistry `0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4` returns `0xFeAf5C921996FC53f4DEf35e181E766e6D74690A`. `ownerOf(bytes32)` with the ENSIP-1 namehash reverts on that registry. `solvers.rival.eth` does not resolve yet. A resolver lookup returns no resolver. Universal Resolver has no path to the solvers registry until the bootstrap broadcast (`docs/ens-design.md`). `atlas` is the only registered solver. Solver registration transaction: `0xeb84111137557cecc2fb0954eb8eb8ebd26d6c78aca6174b96b08d91e48d16de`.

| Requirement | Feature | Location | Evidence |
| --- | --- | --- | --- |
| ENSv2 register, ownerOf, renew, unregister on Sepolia | `RivalNames` plus a `PermissionedRegistry` this repo deployed | `contracts/script/DeployNames.s.sol`, `docs/ens-design.md` | Solvers registry `0xCEec9D7ADcad00e4D842283d9526E75C9440b36f`. Names `0xC20a61e830bB91A69C1B6BCcd607299152aDE797`. Registry `0x6AD5C78fA2278d397Bb7e04e1e2266Cc39a1109E`. Label store is `MockLabelStore` `0x3c328efaFa5a2493121e824695C791f78Ee5D360`. No `.eth` parent. H-006 stays waived. |
| Name hierarchy under `rival.eth` | Not deployed | `deployments/sepolia.json` `ens` | `parentLabel` is `rival`. The canonical ENS addresses are the zero address. This solvers registry is not a subregistry of a `.eth` name. |
| Role bitmap and non-transferable names | `SOLVER_ROLE_BITMAP` is `0`. `ROLE_CAN_TRANSFER_ADMIN` is absent | `docs/ens-design.md`, `docs/spikes/S3.md` | `safeTransferFrom` reverted `TransferDisallowed` in the S3 integration test. A role change regenerates the token id and `isListed` fails closed (`test_roleChangeStalesStoredTokenId`). |
| Per-record resolver text and `com.rival.*` | Fallback (b): stats live in `RivalNames.protocolRecord` | `docs/spikes/S3.md`, `docs/ens-design.md` | `PermissionedResolver` does not compile here. The `ens-contracts` submodule is empty. Resolver is `address(0)`. `syncRecords` does not call `setText`. |
| Expiry, exit, unregister | 30-day expiry on `issue`. `exit` unregisters and refunds the 100 tUSDC deposit | `docs/ens-design.md` | S3: at expiry, `ownerOf` returned `address(0)` and `unregister` reverted `LabelExpired`. `renew` from `RivalNames` revived the name. Deposit is `100000000` (100 tUSDC, 6 decimals). |
| On-chain gating | `SolverRegistry.isListed` reads `ownerOf` and fails closed | `docs/ens-design.md` | The registry's own label mapping is not the gate. An open intent does not need this read. |
| Agents as namespaces | Not granted | `docs/ens-design.md` | Solver text roles (`description`, `url`, `agent-context`, `agent-endpoint`, `agent-registration`) need `PermissionedResolver`. They were not granted. |
| Live demo | One absolute fill, one registered solver | `docs/demo.md` | Site https://rival-flame.vercel.app. Runner https://rival-runner.fly.dev. The one-hour soak has not been run. |

# Arkiv

| Requirement | Feature | Evidence | Artifact |
| --- | --- | --- | --- |
| Write with `@arkiv-network/sdk` `1.0.1` | `publishIntent` and `upsertPresence` | `docs/spikes/S4.md`. Intent entity `0x69f6569e17554a03abc6f8dfb7e3d3ac97969237d7bbebf8e06b63a3ac8c80bd`. Presence entity `0x7aa547a505912f9aba6efdd4ae1bd416d621e03d46184aadc3a61a752ca36001`. | `packages/arkiv/src/book.ts`, `arkiv/schema.md` |
| A read of that write | Open-intent query and `amountIn` `BETWEEN` both returned the entity. Presence count for the pair was 1. | Write 6761 ms. Query 1005 ms, 1 attempt. `u256` `BETWEEN` matched. `extendEntity` 6092 ms. tGLM spent `0.000456736`. | `docs/spikes/S4.md` |
| Writer address and a query | The S4 writer is the operator. `deployments/sepolia.json` `arkivWriterAddresses` is still `[]`. | Account `0xFeAf5C921996FC53f4DEf35e181E766e6D74690A` | Writer table and query below |
| Not only a log | The S4 open query read the entity it had just written | The Trade UI is not on a production URL. The absolute fill in `docs/demo.md` is an on-chain fill. That page does not say the fill was discovered from Arkiv. | `arkiv/how-you-use-arkiv.md` |

Browser CORS was not called. The S4 run used the Rabdi Node RPC and the write key for both clients. Two read keys were configured.

# Writer addresses

| Role | Address |
| --- | --- |
| S4 Arkiv writer (operator). Wrote the intent entity and the presence entity. | `0xFeAf5C921996FC53f4DEf35e181E766e6D74690A` |
| `deployments/sepolia.json` `arkivWriterAddresses` | empty |

# Runnable query

This is the open-intent query from `docs/spikes/S4.md`. It matched intent `0x01a5ef0a10928187780117b39b2158c8b6da32fff0f556e3e12e7f5bd84cce00` on 2026-11-06T07:39:02.333Z. The balanced preset sets `deadline` to `startTime + 150` seconds (`packages/intent/src/presets.ts`, `packages/intent/src/build.ts`). `publishIntent` expires the entity at `deadline + 5` minutes (`packages/arkiv/src/book.ts`). That entity is expired. Running this query now can return no rows.

```sql
arkiv.schema = str('rival.intent.v1') AND status = str('open') AND pair = str('s4-1793950742') AND deadline > u64(1793950742) ORDER BY deadline:u64 ASC
```

The product query uses pair `tWETH/tUSDC` and a current unix second in place of the `u64` literal. Grammar and the other filters are in `specs/arkiv-queries.md`. There is no `<now>` token.

# Third-party

| Component | Version | License |
| --- | --- | --- |
| forge-std | `v1.17.0` | Apache-2.0 (`contracts/lib/forge-std/LICENSE-APACHE`; the tree also contains `LICENSE-MIT`. `THIRD_PARTY.md` records Apache-2.0) |
| solady | `v0.1.26` | MIT |
| OpenZeppelin contracts | `v5.7.0` | MIT |
| Uniswap v4-core | `1.0.2` | BUSL-1.1 |
| Uniswap v4-periphery | `1.0.3` | MIT (`contracts/lib/v4-periphery/LICENSE`) |
| Permit2 | tag `0x000000000022D473030F116dDEE9F6B43aC78BA3` | MIT |
| ENS contracts-v2 | `main` `48b3e2d3` | see upstream (`THIRD_PARTY.md`). The vendored tree has no `LICENSE` file. Solidity sources in that tree carry `SPDX-License-Identifier: MIT`. |
| `@arkiv-network/sdk` | `1.0.1` | MIT |
| viem | `2.57.16` | MIT |

`Uniswap/v4-core` stays BUSL-1.1. Rival's contracts are separate and are MIT. Full notices: `THIRD_PARTY.md`. The MIT holder is Shreyas Sovani.

# Limitations

- The one-hour soak has not been run. The site is https://rival-flame.vercel.app and the runner is https://rival-runner.fly.dev. This tree is deployed on Fly with `RUNNER_SERVICES=on`. `GET /api/intents` returns Arkiv rows and a presence count. `/api/health` is still `degraded` while the oracle is older than 120 seconds, the house holds no test tokens, or the book is empty. The Vercel site is still the previous build.
- `rival.eth` is registered to the operator. `solvers.rival.eth` does not resolve. `atlas` is the only registered solver. The subname bootstrap has not been broadcast.
- One absolute fill hash is in `docs/demo.md`. That page does not record a pegged fill. The judge-journey table there marks steps 1–6, 10, and 13 as not yet observed in a browser. In this tree the faucet claim is signed against tWETH `0x45E6a5bD3be4D00E7Be57287D7d25De3F833253d`, an empty Arkiv book says `no open intents`, and an auction link opened in a browser that never signed says to sign on the Trade page. Get test tokens still waits on a stocked house balance. The production URL does not have those changes until the site is redeployed.
- Deployed `RivalNames` still stores `com.rival.*` in `protocolRecord` because its resolver immutable is zero. Source `syncRecords` calls `setText` only when that immutable is set. `NameCoder` is vendored under `contracts/src/ens/vendor/`. `PermissionedResolver` is not, because the rest of that tree does not compile here.
- The trade page keeps one decay chart, inside the composer. Sign, faucet, auction, book, and solvers are wired in this tree. They are not on the production URL until the site is redeployed.
- The S4 Arkiv entities were written by `0xFeAf5C921996FC53f4DEf35e181E766e6D74690A`. `arkivWriterAddresses` in `deployments/sepolia.json` is empty. Browser CORS was not exercised. The three-minute presence expiry was not waited out.
- The V4Quoter `eth_call` in `scripts/demo-live.ts` reverted. The committed demo records the fixed floor, not the revert data.
- The MIT holder is Shreyas Sovani (`LICENSE`).

# AI usage

Coding agents wrote the implementation and these documents. A person has not signed `AI_USAGE.md`. The tools and the slave-pass list are in that file.
