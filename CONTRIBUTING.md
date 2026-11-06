# Contributing

## Setup

- Node.js 22 (`nvm use` reads `.nvmrc`).
- pnpm 9.15.9 (`packageManager` in the root `package.json`).
- Foundry (`forge` 1.x) for `contracts/`.

```sh
pnpm install
git config core.hooksPath .githooks
```

The pre-commit hook runs `pnpm territory:check`. Export `AGENT_ROLE` before you commit.

## CI

`.github/workflows/ci.yml` runs lint, typecheck, test, forge build, and forge test on push and pull request. `.github/workflows/e2e-synthetic.yml` runs every 30 minutes and is allowed to fail until the synthetic suite exists. Pull requests use `.github/pull_request_template.md`. The license holder is `FILL(FOUNDER_NAME)` until H-001 writes `FOUNDER_NAME` in `docs/ENV.md`.

## Agent role

Export exactly one of these in the shell that commits:

```sh
export AGENT_ROLE=MASTER
export AGENT_ROLE=SLAVE
```

File ownership, task order, and proof rules are in `BACKLOG.md`. Do not edit another role's files.

## Secrets

Never commit secrets. They belong in `secrets/.env.local` (gitignored). `.env.local` and `secrets/` must stay untracked.

## Slave work on main (2026-11-06)

`main` is at `e15bb7d`. Submission skeletons (`README.skeleton.md`, `FEEDBACK.skeleton.md`, `RUNBOOK.skeleton.md`, `arkiv/*.skeleton.md`) stay headings and `FILL(` tokens until the product facts exist. `docs/architecture.md` is the PRD §6.1–§6.5 diagrams, copied verbatim. Pins are in `contracts/DEPS.md`.

| Task | State | What landed | Check |
| --- | --- | --- | --- |
| S-001 | DONE | pnpm workspace, TypeScript/ESLint base, Foundry config, vendored libs | `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && forge build --root contracts` |
| S-002 | DONE | `scripts/backlog.ts`, `scripts/territory-check.ts`, `scripts/freeze-check.ts`, `scripts/freeze-write.ts` | `pnpm backlog:board && pnpm backlog:verify` |
| S-003 | BLOCKED on H-001 | `.github/workflows/ci.yml`, `.github/workflows/e2e-synthetic.yml`, `.github/pull_request_template.md`, `CODEOWNERS`, `.gitattributes`, MIT `LICENSE` | `pnpm exec actionlint .github/workflows/*.yml` |
| S-005 | DONE | `contracts/src/tokens/TestToken.sol`, `contracts/test/TestToken.t.sol` | `pnpm forge:test --match-contract TestTokenTest` |
| S-008 | DONE | `apps/web/src/lib/format.ts`, `apps/web/src/lib/sanitize.ts`, `apps/web/src/testids.ts` | `pnpm --filter @rival/web test -- lib` |
| S-014 | DONE | `packages/arkiv/src/client.ts`, `packages/arkiv/src/rotation.ts` | `pnpm --filter @rival/arkiv test -- client rotation` |
| S-015 | DONE | `packages/solver-sdk/src/retry.ts`, `packages/solver-sdk/src/rpc-pool.ts` | `pnpm --filter @rival/solver-sdk test -- rpc-pool retry` |
| S-018 | DONE | `docs/architecture.md` and the skeletons listed above | existence check in `BACKLOG.md` S-018 |

`LICENSE` is MIT, year 2026, holder `FILL(FOUNDER_NAME)`. H-001 fills that name. There is no `specs/FREEZE.json`, so S-004, S-006, S-009, S-012, S-013, S-016, S-017, and S-019 have not been started. S-007, S-010, S-011, S-020, and S-021 wait on those.

### Libraries pinned for S-001

| Component | Pin | License |
| --- | --- | --- |
| forge-std | `v1.17.0` `f3dae6e6ee381f25eb6a246f7da9b85c91a68219` | see upstream |
| solady | `v0.1.26` `acd959aa4bd04720d640bf4e6a5c71037510cc4b` | see upstream |
| OpenZeppelin contracts | `v5.7.0` `cab19933c33c2ad1d4c7a84864a3601dddfd16f3` | MIT |
| Uniswap v4-core | `1.0.2` `59d3ecf53afa9264a16bba0e38f4c5d2231f80bc` | BUSL-1.1 |
| Uniswap v4-periphery | `1.0.3` `60cd93803ac2b7fa65fd6cd351fd5fd4cc8c9db5` | MIT |
| Permit2 | tag `0x000000000022D473030F116dDEE9F6B43aC78BA3` `cc306b601f172c51bc04334a109e98340456620b` | MIT |
| ENS contracts-v2 | `main` `48b3e2d39513b9dd32ef1850877a29009bc807b9` | see upstream |
| `@arkiv-network/sdk` | `1.0.1` | see package |
| viem | `2.57.16` | see package |

Compiler for this repo: solc 0.8.26, EVM cancun, optimizer runs 200.

### What those tasks actually contain

- `TestToken` is a Solady ERC20. The constructor takes name, symbol, decimals, and a minter. `mint` reverts `NotMinter()` for every other caller. `_givePermit2InfiniteAllowance()` returns true, so the Permit2 allowance reads as `type(uint256).max`. EIP-2612 `permit` is inherited. Transfers do not take a fee.
- `formatUnitsFixed`, `shortHex`, `relativeTime`, `bpsToPercentString`, and `formatDuration` are display helpers. Fractional digits truncate toward zero. `sanitizeDisplayText` strips C0/C1 controls, bidi overrides and isolates, and zero-width characters, normalizes to NFC, truncates with an ellipsis, and returns plain text.
- `createArkivClients` builds an Arkiv public client with `createPublicClient` and `rabdi({ accessKey })`, plus a wallet-client factory. Read keys rotate on HTTP 401 and 429 with cooldown and exponential backoff. The active key is also sent as `X-API-KEY` and is not logged. The SDK still places the key in the Rabdi URL path.
- `withRetry` retries when `isRetryable` says so. `createRpcPool` is a viem `custom` transport. It round-robins URLs, rotates on timeout, 429, and 5xx, honors `Retry-After`, and exposes `stats()`.

### Sepolia ETH (H-002, still open for tGLM)

Operator `0xFeAf5C921996FC53f4DEf35e181E766e6D74690A` started at 3.330 ETH and held 1.179 ETH after the sends below. Keys stay in `secrets/.env.local`. tGLM for the solver and publisher wallets is still outstanding, so H-002 is not done.

| Role | Address | ETH sent |
| --- | --- | --- |
| MM | `0x16A13b04775D733aEAAAb88d77A69d1b9ffA0062` | 1.00 |
| HOUSE | `0x79bC47e448b1B52F3DE651a0d102FD73FaDD7B7C` | 0.30 |
| SOLVER_ATLAS | `0xD2aA21AF4faa840Dea890DB2C6649AACF2C80Ff3` | 0.100 |
| SOLVER_MERIDIAN | `0x97e6c2b90492155bFA552FE348A6192f4fB1F163` | 0.100 |
| SOLVER_FENIX | `0x8AF6577a9ea6B9372Df5fD8762D8d9789E04275F` | 0.100 |
| SOLVER_VAULT | `0x7521EE686392EF1f27B2DDc757653875a7C3F831` | 0.100 (balance 0.116 with existing dust) |
| RELAYER | `0x8cEa9b4F8C42464A3661b5ea08FD5EE566557c45` | 0.20 |
| MAKERBOT_1 | `0xFc21eC9b802932918640F5Ce8f372E1A5b2EE81a` | 0.05 |
| MAKERBOT_2 | `0x7A23914e049954145c285F951D83b9a63C9D4Eda` | 0.05 |
| MAKERBOT_3 | `0x13e17fC2Eb8CD89BD433AB6b131047b1A1BF1531` | 0.05 |
| FAUCET_MINTER | `0x29EEBc9d07d725f72D3de5D47eA048187fc800A9` | 0.05 |
| UNLISTED_BOT | `0xA3d458197eD27a1Af545Cd37b495a0ff56A8927C` | 0.05 |
