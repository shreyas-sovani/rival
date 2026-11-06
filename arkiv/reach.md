# Who can use it

| Who | How |
| --- | --- |
| Solver operators | `pnpm solver:init --label <label>` calls `initSolver` with `SOLVER_PRIVATE_KEY` (or `--key-env`) and a Sepolia RPC (`scripts/cli/solver-init.ts`). Registration pulls a 100 tUSDC deposit (`100000000` base units) on `SolverRegistry` `0x6AD5C78fA2278d397Bb7e04e1e2266Cc39a1109E`. `atlas` is the only solver that has been registered. `pnpm solver:dev` is the local bot command. It is not a hosted soak. |
| Traders | The static web app is https://rival-flame.vercel.app. The recorded maker path is `scripts/demo-live.ts`: one absolute fill, hash in `docs/demo.md`. |
| Agent builders | Read `rival.intent.v1` and `rival.solver.v1` with the queries in `arkiv/schema.md` and `specs/arkiv-queries.md`. The S4 read used the Rabdi Node RPC and an access key. Browser CORS was not called. |

# Can they try today

- The production site is https://rival-flame.vercel.app. The Fly hostname https://rival-runner.fly.dev is assigned, and the machine has not booted. `deployments/sepolia.json` `runnerUrl` is still `https://runner.local`.
- The query that returned a row is in `docs/spikes/S4.md` and in `arkiv/schema.md`. It matched on 2026-11-06T07:39:02.333Z. The intent entity expires at `deadline + 5` minutes, so that row is gone. Running the same text today can return no rows.
- `pnpm solver:init --label <label>` is the command in the repo. It still needs a funded key, Sepolia ETH, and 100 tUSDC. It was not run for a second label. `atlas` was registered by the demo script, transaction `0xeb84111137557cecc2fb0954eb8eb8ebd26d6c78aca6174b96b08d91e48d16de`.

# Post-Mumbai plan

Keep the book on Rabdi and the fills on Sepolia. The public web origin is https://rival-flame.vercel.app. Run the one-hour soak only after the Fly machine at https://rival-runner.fly.dev is serving `/api/health`. The soak has not been run. Buying `rival.eth` is a later step if `solvers.rival.eth` must resolve in the Sepolia ENS app. `docs/spikes/S3.md` records that a parent registration does not turn on `com.rival.*` text records. Those values stay in `RivalNames.protocolRecord` until `PermissionedResolver` can be compiled and the per-key roles are granted. `atlas` remains the only registered solver until another `register` transaction lands.
