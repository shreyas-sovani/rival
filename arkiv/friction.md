# Arkiv friction

- 2026-11-06 — S4 Node RPC write (6761 ms), query (1005 ms, 1 attempt(s)), u256 BETWEEN matched, presence extendEntity (6092 ms). tGLM spent 0.000456736. No query-grammar rejection. Browser CORS was not exercised.

# Live log

| Topic | Note |
| --- | --- |
| CORS and browser access | S4 used the Rabdi Node RPC. Browser CORS was not called. Two read keys were configured. The run used the write key for both the read client and the write client (`docs/spikes/S4.md`). |
| Quota behavior | The run recorded no quota error and no HTTP 429. It does not describe a quota limit. |
| u256 filter semantics | `amountIn BETWEEN u256(1000000000000000000) AND u256(10000000000000000000)` returned intent entity `0x69f6569e17554a03abc6f8dfb7e3d3ac97969237d7bbebf8e06b63a3ac8c80bd` on pair `s4-1793950742`. |
| extendEntity cost and frequency for presence | Presence entity `0x7aa547a505912f9aba6efdd4ae1bd416d621e03d46184aadc3a61a752ca36001`. Create 5866 ms. One `extendEntity` succeeded in 6092 ms and returned the same key. The whole run spent `0.000456736` tGLM (balance 20 to `19.999543264`). That figure is not split per call. The run did not extend on a 60-second cadence. The three-minute expiry was not waited out. |
| Expiry rounding | Not measured. `publishIntent` sets `ExpirationTime.atDate(deadline + 5 minutes)`. `upsertPresence` sets `ExpirationTime.fromMinutes(3)` (`packages/arkiv/src/book.ts`). No delta between the requested timestamp and the stored expiry was recorded. |
| Query grammar quirks | The open query and the BETWEEN query were accepted. No grammar rejection. `<now>` is not valid. Callers interpolate a unix second into `u64(...)`. A count is a projection (`client.count()`), not a clause in the query string (`specs/arkiv-queries.md`). |
| Explorer URL scheme | S4 did not record an explorer URL. This file does not invent one. |

# Highest-impact improvement

Publish the explorer URL pattern for an entity key, and a browser CORS preflight example for the public Rabdi RPC. S4 only used the Node RPC, so neither the explorer host nor browser access was observed.

