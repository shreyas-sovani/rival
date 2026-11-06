# What users lose with Postgres

- A Postgres book sits behind an API. That API can decide who may list an intent. `rival.intent.v1` is a public Arkiv query. The S4 open-intent query read the entity the same wallet had just written (`docs/spikes/S4.md`). No Rival query service is in that path.
- A Postgres row stays until something deletes it, and the row's author is an application user id. An Arkiv intent is written by a wallet and expires on its own. `publishIntent` sets that expiry to `deadline + 5` minutes (`packages/arkiv/src/book.ts`).
- Solver presence would need a cleanup job. `rival.solver.v1` is created with `ExpirationTime.fromMinutes(3)`. The owner extends it. S4 extended once (6092 ms) and did not wait out the three minutes, so this file does not claim a watched disappearance.
- Any client that can query Rabdi can run the same filter. The S4 run used the Node RPC. Browser CORS was not called.

# What was kept off Arkiv

| Kept off | Why |
| --- | --- |
| Token balances and the fill | Funds move through Permit2 and `RivalSettlement` on Sepolia. The absolute fill `0xeadff32d9c91c28bab2c9dc8136c7d1a2ef2c0091085f1a0e2d891645e9500ec` is a chain transaction (`docs/demo.md`). Arkiv `status` is an advisory patch. |
| Solver reputation | `fills`, `makers`, `sumImprovementBps`, and `lastFill` are stored on `RivalNames` and exposed as `protocolRecord`. They are not ENS text and they are not Arkiv columns (`docs/ens-design.md`, `docs/spikes/S3.md`). |
| Keys | `OPERATOR_PRIVATE_KEY` and `ARKIV_ACCESS_KEY_WRITE` stay in `secrets/.env.local`. The signed intent in `payload` is public by design (`packages/arkiv/src/schemas.ts`). |
| The ENS parent | `rival.eth` is registered to the operator on Sepolia ENSv2. `solvers.rival.eth` does not resolve yet. Identity for the one registered solver, `atlas`, is still the solvers `PermissionedRegistry` this repo deployed. |
