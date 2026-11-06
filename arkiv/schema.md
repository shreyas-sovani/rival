# Schemas

Source: `packages/arkiv/src/schemas.ts`. `str` values are at most 128 bytes. `payload` is `bytes`, capped at 2 KiB by the publisher and at 128 KiB by the SDK.

| Schema | Field | Type |
| --- | --- | --- |
| `rival.intent.v1` | `intentHash` | `str` indexed |
| `rival.intent.v1` | `maker` | `addr` indexed |
| `rival.intent.v1` | `pair` | `str` indexed |
| `rival.intent.v1` | `tokenIn` | `addr` indexed |
| `rival.intent.v1` | `tokenOut` | `addr` indexed |
| `rival.intent.v1` | `amountIn` | `u256` indexed |
| `rival.intent.v1` | `mode` | `i32` indexed (`0` absolute, `1` pegged) |
| `rival.intent.v1` | `gate` | `i32` indexed (`0` open, `1` listed, `2` named) |
| `rival.intent.v1` | `startTime` | `u64` indexed |
| `rival.intent.v1` | `deadline` | `u64` indexed |
| `rival.intent.v1` | `decaySecs` | `i32` indexed |
| `rival.intent.v1` | `startBps` | `i32` |
| `rival.intent.v1` | `floorBps` | `i32` |
| `rival.intent.v1` | `hardMinOut` | `u256` |
| `rival.intent.v1` | `status` | `str` indexed (`open`, `filled`, `cancelled`) |
| `rival.intent.v1` | `filledBy` | `addr` optional |
| `rival.intent.v1` | `fillTx` | `str` optional |
| `rival.intent.v1` | `publisher` | `addr` |
| `rival.intent.v1` | `payload` | `bytes` (JSON `{ intent, signature }`) |
| `rival.solver.v1` | `solver` | `addr` indexed |
| `rival.solver.v1` | `ensName` | `str` indexed |
| `rival.solver.v1` | `pair` | `str` indexed |
| `rival.solver.v1` | `maxAmountIn` | `u256` |
| `rival.solver.v1` | `strategy` | `str` |
| `rival.solver.v1` | `endpoint` | `str` optional |
| `rival.solver.v1` | `version` | `str` |

# Indexed fields

Only indexed columns can appear in a comparison (`specs/arkiv-queries.md`).

| Field | Why |
| --- | --- |
| `intentHash`, `maker`, `pair`, `tokenIn`, `tokenOut` | Select one intent, one maker, or one pair without scanning payloads. |
| `amountIn` | The size filter is `BETWEEN` on this column. S4 matched `u256(1000000000000000000)` through `u256(10000000000000000000)`. |
| `mode`, `gate`, `status` | Mode and gate are small enums. `status` is the publisher's advisory patch. |
| `startTime`, `deadline`, `decaySecs` | `deadline > u64(...)` is the open-book bound. `deadline` is the sort key. `$createdAt` is not sortable. |
| `solver`, `ensName`, `pair` on `rival.solver.v1` | Presence count for a pair, and a lookup by solver or name. |
| `startBps`, `floorBps`, `hardMinOut`, `publisher`, `payload`, `maxAmountIn`, `strategy`, `endpoint`, `version` | Stored and selectable. Not filterable. |

# Owners

| Schema | Owner |
| --- | --- |
| `rival.intent.v1` | The wallet that calls `createEntity`. That owner is who `patchStatus` can be. S4's writer is the operator `0xFeAf5C921996FC53f4DEf35e181E766e6D74690A`. `deployments/sepolia.json` `arkivWriterAddresses` is empty. |
| `rival.solver.v1` | The wallet that calls `createEntity` or `extendEntity`. S4 used the same operator account. The product rule is that each solver wallet owns its own presence (`packages/arkiv/src/schemas.ts`). |

# Lifetimes

| Schema | Lifetime |
| --- | --- |
| `rival.intent.v1` | `deadline + 5` minutes (`ExpirationTime.atDate` in `packages/arkiv/src/book.ts`). |
| `rival.solver.v1` | 3 minutes (`ExpirationTime.fromMinutes(3)`). The owner extends it. S4 extended once and did not repeat on a 60-second cadence. |

# Canonical queries

The query that returned a row (`docs/spikes/S4.md`). The entity is expired. A later run can return no rows.

```sql
arkiv.schema = str('rival.intent.v1') AND status = str('open') AND pair = str('s4-1793950742') AND deadline > u64(1793950742) ORDER BY deadline:u64 ASC
```

The BETWEEN query that also matched that entity:

```sql
arkiv.schema = str('rival.intent.v1') AND status = str('open') AND pair = str('s4-1793950742') AND amountIn BETWEEN u256(1000000000000000000) AND u256(10000000000000000000) AND deadline > u64(1793950742)
```

Presence count filter used for that pair (the count is a projection, not a clause in the string):

```sql
arkiv.schema = str('rival.solver.v1') AND pair = str('s4-1793950742')
```

The pair a solver of the deployed pools would watch. Replace `1762401600` with the current unix second (`specs/arkiv-queries.md`). `<now>` is not valid syntax.

```sql
arkiv.schema = str('rival.intent.v1') AND status = str('open') AND pair = str('tWETH/tUSDC') AND deadline > u64(1762401600) ORDER BY deadline:u64 ASC
```

# Writer wallet addresses

| Role | Address |
| --- | --- |
| S4 intent and presence writer (operator) | `0xFeAf5C921996FC53f4DEf35e181E766e6D74690A` |
| `deployments/sepolia.json` `arkivWriterAddresses` | empty |

# Trust model

Arkiv is public. `payload` holds the signed intent. Consumers recompute `intentHash` and verify the Permit2 witness before they treat the row as an order (`packages/arkiv/src/book.ts` `verifyPayload` on the way in; solvers use `packages/solver-sdk` witness checks on the way out). They re-check settlement status, the Permit2 nonce, and the maker's balance on Sepolia before sending a fill. `status`, `filledBy`, `fillTx`, and `publisher` are the owner's patch. They are not the authorization decision. Anyone can write an entity with `arkiv.schema = str('rival.intent.v1')`. The signature and the chain are the check (`specs/arkiv-queries.md`).
