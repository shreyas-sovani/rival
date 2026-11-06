# Arkiv canonical queries

Grammar confirmed against Arkiv's query-language reference on 6 Nov 2026 (`https://docs.arkiv.network/reference/query-language`). The PRD §7.4 sketches already match that grammar (`ORDER BY attr:type DIR`, `BETWEEN`, typed literals, `arkiv.schema` tag). Two adjustments:

1. `<now>` is not valid syntax. Callers interpolate a decimal unix-second integer into `u64(...)`.
2. A count is a projection (`client.count()` / `arkiv_query` with the count projection), not a clause inside the query string. The presence query below is the filter; the count wraps it.

Named-schema queries also match entities written through `defineSchema`, which stores `arkiv.schema`. Anyone can write that tag. Consumers still verify `payload` signatures and on-chain status (PRD §7.4 trust model).

`str` literals must be ≤ 128 bytes. `ensName` values such as `atlas.solvers.rival.eth` fit. `payload` is `bytes` and is not filtered.

## 1. What a solver watches

Open intents for the pair whose deadline is still in the future, soonest deadline first.

```sql
arkiv.schema = str('rival.intent.v1') AND status = str('open') AND pair = str('tWETH/tUSDC') AND deadline > u64(1762401600) ORDER BY deadline:u64 ASC
```

Replace `1762401600` with the current unix time. Example is 2026-11-06T04:00:00Z.

## 2. Size filter

Open intents whose `amountIn` is between 1 tWETH and 10 tWETH (18 decimals), inclusive.

```sql
arkiv.schema = str('rival.intent.v1') AND status = str('open') AND amountIn BETWEEN u256(1000000000000000000) AND u256(10000000000000000000)
```

## 3. A maker's intents

```sql
arkiv.schema = str('rival.intent.v1') AND maker = addr(0x0000000000000000000000000000000000000001)
```

Replace the address. `addr` literals are EIP-55 or lowercase hex; the node compares raw bytes.

## 4. Named-solver intents

```sql
arkiv.schema = str('rival.intent.v1') AND gate = i32(2) AND status = str('open')
```

`gate` 0 is open, 1 is listed, 2 is named. `mode` 0 is absolute, 1 is pegged (same `i32` comparison).

## 5. Who is online for the pair

Filter (one row per live presence entity):

```sql
arkiv.schema = str('rival.solver.v1') AND pair = str('tWETH/tUSDC')
```

Count projection, SDK shape:

```ts
client.count().from(SolverPresence).where(eq("pair", "tWETH/tUSDC")).fetch()
```

Entities past their 3-minute expiry do not appear. No cleanup transaction is required.

## Notes for query builders

- Only indexed columns can appear in a comparison. `startBps`, `floorBps`, `hardMinOut`, `publisher`, `payload`, `maxAmountIn`, `strategy`, `endpoint`, and `version` are stored and selectable, not filterable.
- Sort one column only. `$createdAt` is not sortable. `deadline` is.
- Page size max is 100 (`MAX_LIMIT`).
- `status` is the publisher's patch (`open`, `filled`, `cancelled`). It is not an authorization decision.
