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
