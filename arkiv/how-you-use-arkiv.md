# Features

`atlas` is the only registered solver. The one-hour soak has not been run. The site is https://rival-flame.vercel.app. The runner machine has not booted. The S4 book used pair `s4-1793950742`, not the production pair `tWETH/tUSDC`.

| Feature | Filters | Who can edit | Expiry | What changes for users |
| --- | --- | --- | --- | --- |
| Open intent book (`rival.intent.v1`) | `arkiv.schema`, `status`, `pair`, `deadline > u64(...)`, optional `amountIn BETWEEN`, `maker`, `gate` (`specs/arkiv-queries.md`). Indexed columns only. | The `createEntity` caller owns the entity and is the wallet that may `patchEntity` `status`, `filledBy`, and `fillTx` (`packages/arkiv/src/book.ts` `patchStatus`). S4's owner is the operator `0xFeAf5C921996FC53f4DEf35e181E766e6D74690A`. `status` is advisory. Solvers re-check the chain. | `deadline + 5` minutes via `ExpirationTime.atDate` (`packages/arkiv/src/book.ts`). The balanced preset used in S4 sets `deadline` to `startTime + 150` seconds. | A solver can read an open intent without a Rival API. S4's query found the entity in 1005 ms on the first attempt. That entity is expired now. |
| Size filter | `amountIn BETWEEN u256(1000000000000000000) AND u256(10000000000000000000)` on the S4 pair | Same owner as the intent entity. The filter is a read. | Same as the intent entity. | The BETWEEN query returned the same entity (`docs/spikes/S4.md`). |
| Named-gate filter | `gate = i32(2)` and `status = str('open')` (`specs/arkiv-queries.md`). `gate` 0 is open, 1 is listed, 2 is named. | Same owner. | Same as the intent entity. | S4 published `gate` 0. This named-gate query was not the query that returned the S4 row. |
| Solver presence (`rival.solver.v1`) | `pair` for the count. `solver` and `ensName` are indexed. `maxAmountIn`, `strategy`, `endpoint`, and `version` are stored and are not filterable. | The wallet that created the entity. `upsertPresence` extends when `entityKey` is set. The 60-second cadence is the caller's job (`packages/arkiv/src/book.ts`). | 3 minutes via `ExpirationTime.fromMinutes(3)`. | S4 created one presence row, extended it once, and counted 1 for that pair. The count dropping after a dead bot was not waited out. The Trade page that would show the count has no production URL. |

# Not counted self-check

- The S4 path writes an intent and then reads it back with the open-intent query and the `amountIn` BETWEEN query. That is a read of Arkiv, not an install-only check.
- The absolute fill in `docs/demo.md` is an on-chain fill by `atlas`. That page does not say the fill was chosen from an Arkiv query. The one-hour soak, which is where several solvers would fill from the book, has not been run.
- Presence was written and counted. Browser CORS was not called, and the three-minute expiry was not watched.
- `deployments/sepolia.json` `arkivWriterAddresses` is empty. The writer of the S4 entities is the operator address in `docs/spikes/S4.md`.
