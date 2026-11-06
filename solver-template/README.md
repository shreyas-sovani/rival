# Solver template

Third-party solvers use the same two commands as the in-repo bots.

## Steps

1. Copy `.env.example` to a local env file. Do not commit it.
2. Fill `SEPOLIA_RPC_URL`, `SOLVER_PRIVATE_KEY`, and `ARKIV_ACCESS_KEY_WRITE`.
3. Register the name:

```sh
pnpm solver:init --label <name>
```

4. Run the process:

```sh
pnpm solver:dev
```

`solver:init` accepts `--label`, `--rpc`, and `--key-env`. `solver:dev` accepts `--label`, `--rpc`, `--key-env`, and `--strategy`.
