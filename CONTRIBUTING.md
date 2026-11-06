# Contributing

## Setup

- Node.js 22 (`nvm use` reads `.nvmrc`).
- pnpm 9.15.9 (`packageManager` in the root `package.json`).
- Foundry (`forge` 1.x) for `contracts/`.

```sh
pnpm install
git config core.hooksPath .githooks
```

The pre-commit hook runs `pnpm territory:check`. Until S-002 that command is a stub and exits 0.

## Agent role

Export exactly one of these in the shell that commits:

```sh
export AGENT_ROLE=MASTER
export AGENT_ROLE=SLAVE
```

File ownership, task order, and proof rules are in `BACKLOG.md`. Do not edit another role's files.

## Secrets

Never commit secrets. They belong in `secrets/.env.local` (gitignored). `.env.local` and `secrets/` must stay untracked.
