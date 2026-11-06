# Deploy

The contracts below are already on Sepolia. Addresses are in `deployments/sepolia.json`. The production site is https://rival-flame.vercel.app. Do not treat `https://runner.local` as a public host. Fly assigned https://rival-runner.fly.dev in organization `shreyas-sovani` (slug `shreyas-sovani-944`), and that machine has not booted until a card is added at https://fly.io/dashboard/shreyas-sovani-944/billing. The static site does not embed the runner placeholder. Evidence, book, and leaderboard links go to `sepolia.etherscan.io`. The one-hour soak has not been run.

1. Venue (tokens, hook, pool A, pool B): `contracts/script/DeployVenue.s.sol`, driven by `scripts/pools-deploy.ts`. Hook `0xb17a547082836fDF87001c1DE031fA8A2D391080`, flag mask `0x1080`, salt `0x0000000000000000000000000000000000000000000000000000000000000d1d`. PoolManager `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`. StateView `0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C`. V4Quoter `0x68aFa8b853cAa7a2D40B0F6AEE5C4DbC147C8244`.
2. Names: `contracts/script/DeployNames.s.sol`. `RivalNames` `0xC20a61e830bB91A69C1B6BCcd607299152aDE797`, `SolverRegistry` `0x6AD5C78fA2278d397Bb7e04e1e2266Cc39a1109E`, solvers `PermissionedRegistry` `0xCEec9D7ADcad00e4D842283d9526E75C9440b36f`. `rival.eth` was not bought. `solvers.rival.eth` does not resolve (`docs/ens-design.md`).
3. Settlement and solver: `contracts/script/Deploy.s.sol`, driven by `scripts/deploy.ts`. `Deploy` reads `OPERATOR_PRIVATE_KEY`, `ORACLE`, `REGISTRY`, `CURRENCY0`, `CURRENCY1`, and `HOOKS`. It reverts if the registry already has a settlement. RivalSettlement `0xdD66D017e4B4FfF51aBEf2f559C68065D4FD9850`. UniswapSolver `0xDBe8a61e1A4cDd767FfA7C822C242B8E85414e17`. `settlementLocked` is true (`docs/oracle.md`).
4. The recorded demo is `scripts/demo-live.ts`, written up in `docs/demo.md`. Pool A was warmed. `atlas` (`0xD2aA21AF4faa840Dea890DB2C6649AACF2C80Ff3`) is the only registered solver (`register` tx `0xeb84111137557cecc2fb0954eb8eb8ebd26d6c78aca6174b96b08d91e48d16de`). The one absolute fill is `0xeadff32d9c91c28bab2c9dc8136c7d1a2ef2c0091085f1a0e2d891645e9500ec`.

# Rollback

1. `SolverRegistry.setSettlement` can be called once. A second call reverts. `docs/oracle.md` records `settlementLocked` true, so this registry cannot be pointed at a new settlement. A replacement is a new registry, a new names contract, and a new settlement. The hook and the pools can stay.
2. `atlas` can `exit` only while the name is unexpired. After expiry, `unregister` reverts `LabelExpired` until `RivalNames.renew` revives it (`docs/ens-design.md`). The 100 tUSDC deposit (`100000000` base units) is refunded on a successful `exit`. Stats are not cleared.
3. Roll the site back from the Vercel project `rival` in team `shreyas-sovanis-projects`. The current production alias is https://rival-flame.vercel.app. There is no running runner machine to roll back.

# Health

- `apps/runner/src/bots/check.ts` `runCheck` reads `oldestTimestamp` on the hook for pool A. It returns 0 when the call returns a timestamp. It returns 1 when `SEPOLIA_RPC_URL` is unset, the deployment record is unusable, or the call reverts.
- `apps/runner/src/services/index.ts` `runCheck` throws `NotImplemented` unless `RUNNER_SERVICES=on`. `startServices` throws `NotImplemented`. That path is one timestamp read. It is not the one-hour soak.
- Pool A was warmed by `scripts/demo-live.ts`. Oldest observation timestamp recorded in `docs/demo.md`: `1793958588`. `consult(pool A, 60)` worked at tick `-196257`.
- No external uptime monitor is configured. H-009 can watch https://rival-flame.vercel.app now. `https://rival-runner.fly.dev/api/health` stays down until the Fly machine launches.

# Recovery

| Failure | Action |
| --- | --- |
| `oldestTimestamp` read returns 1 | Confirm `SEPOLIA_RPC_URL` and that `deployments/sepolia.json` still has hook `0xb17a547082836fDF87001c1DE031fA8A2D391080` and pool A `0xd302ad11d027e1897d14162ac1d7a583a7c48a12a547a25c12c9bb1da504f13f`. A revert from the hook is an insufficient-history or missing-code condition, not a soak result. The one-hour soak has not been run. |
| Quoter `eth_call` reverts | `scripts/demo-live.ts` lines 669–679 already hit this on V4Quoter `0x68aFa8b853cAa7a2D40B0F6AEE5C4DbC147C8244`. The committed demo used hard floor `1799099` tUSDC base units. Hook `quote` remains the TWAP mid and is a different call (`docs/oracle.md`). |
| Registry already bound | `scripts/deploy.ts` stops when `settlement()` is not the zero address or `settlementLocked` is true. The current binding is settlement `0xdD66D017e4B4FfF51aBEf2f559C68065D4FD9850`. Do not send a second `setSettlement`. |
| Solver name lapsed and `exit` reverts | `renew` from `RivalNames`, then `exit`. `unregister` reverts `LabelExpired` once `block.timestamp >= expiry` (`docs/ens-design.md`). |
| `solvers.rival.eth` has no resolver | Expected. `rival.eth` was not bought. The solvers registry is not under a `.eth` name. `atlas` is still the only registered solver on `0x6AD5C78fA2278d397Bb7e04e1e2266Cc39a1109E`. |
