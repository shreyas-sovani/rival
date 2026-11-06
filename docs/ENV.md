# Environment

Generated from `specs/env.schema.json`. This file lists names, descriptions, secret flags, and owning human tasks. It contains no values.

Secrets go in `secrets/.env.local` (gitignored). Check one target with:

```bash
node --experimental-strip-types scripts/env-check.ts --target <target>
```

The command loads `secrets/.env.local` when that file exists, then process environment. It prints `OK` or `MISSING: NAME,NAME` and exits 1 when a required name is absent or blank. It never prints values.

## Project metadata

H-001 writes the legal name used as the MIT license holder.

FOUNDER_NAME=Shreyas Sovani

## Example files

| Target | File |
| --- | --- |
| web-build | `apps/web/.env.example` |
| runner | `apps/runner/.env.example` |
| operator | `.env.example` |
| solver-template | `solver-template/.env.example` |
| ci | `.env.example` |

Operator and ci share `.env.example`. Each target is its own commented section. The other targets have their own example files.

## web-build

Example: `apps/web/.env.example`

| Name | Secret | Human task | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_CHAIN_ID` | no | H-008 | EVM chain id. This build uses Sepolia 11155111. |
| `NEXT_PUBLIC_DEPLOYMENTS_URL` | no | H-008 | URL of deployments/sepolia.json, or the literal inlined when the static export embeds it. |
| `NEXT_PUBLIC_SEPOLIA_RPCS` | no | H-008 | Comma-separated CORS-capable Sepolia HTTP RPCs, at least three. |
| `NEXT_PUBLIC_RABDI_RPC` | no | H-008 | Rabdi HTTP RPC. CSP connect-src reads this host. Public default is https://rpc.rabdi.db-chain.testnet.arkiv.network. |
| `NEXT_PUBLIC_ARKIV_ACCESS_KEYS_READ` | no | H-005 | Comma-separated Arkiv read keys. Public and quota-limited. Not the write key. |
| `NEXT_PUBLIC_RUNNER_URL` | no | H-004 | HTTPS origin of the runner. No trailing path. |

## runner

Example: `apps/runner/.env.example`

| Name | Secret | Human task | Description |
| --- | --- | --- | --- |
| `SEPOLIA_RPC_URL` | yes | H-003 | Primary Sepolia HTTP RPC. |
| `SEPOLIA_RPC_URL_2` | yes | H-003 | Second Sepolia HTTP RPC, different provider. |
| `SEPOLIA_RPC_URL_3` | yes | H-003 | Third Sepolia HTTP RPC, different provider. |
| `MM_PRIVATE_KEY` | yes | H-002 | Market-maker key. 0x-prefixed hex. |
| `HOUSE_PRIVATE_KEY` | yes | H-002 | House solver key. |
| `SOLVER_KEYS_JSON` | yes | H-002 | JSON object of solver keys: atlas, meridian, fenix, vault. Values are 0x private keys. |
| `MAKERBOT_KEYS_JSON` | yes | H-002 | JSON array of three maker-bot private keys. |
| `UNLISTED_BOT_PRIVATE_KEY` | yes | H-002 | Key that is never registered. Used for the gated-fill revert demo. |
| `FAUCET_MINTER_PRIVATE_KEY` | yes | H-002 | TestToken minter. |
| `RELAYER_PRIVATE_KEY` | yes | H-002 | Gas payer for relayed cancelBySig. |
| `ARKIV_ACCESS_KEY_WRITE` | yes | H-005 | Arkiv write key for the publisher wallet. |
| `ARKIV_ACCESS_KEYS_READ` | yes | H-005 | Comma-separated Arkiv read keys. |
| `ALLOWED_ORIGIN` | no | H-008 | Frontend origin allowed by CORS. Equals the production web URL. |

## operator

Example: `.env.example`

| Name | Secret | Human task | Description |
| --- | --- | --- | --- |
| `OPERATOR_PRIVATE_KEY` | yes | H-002 | Deploy, pools, and ENS bootstrap. Founder machine only. Never copied to the runner. |
| `SEPOLIA_RPC_URL` | yes | H-003 | Primary Sepolia HTTP RPC. |
| `SEPOLIA_RPC_URL_2` | yes | H-003 | Second Sepolia HTTP RPC. |
| `SEPOLIA_RPC_URL_3` | yes | H-003 | Third Sepolia HTTP RPC. |
| `ETHERSCAN_API_KEY` | yes | H-007 | Etherscan API key used to verify Sepolia contracts. |
| `ENS_PARENT_LABEL` | no | H-006 | Parent ENS label. Target rival. Fallback chosen in H-006. |

## solver-template

Example: `solver-template/.env.example`

| Name | Secret | Human task | Description |
| --- | --- | --- | --- |
| `SEPOLIA_RPC_URL` | yes | none | Sepolia HTTP RPC for the third-party solver. |
| `SOLVER_PRIVATE_KEY` | yes | none | Key named by solver:init --key-env. The judge generates this locally. |
| `ARKIV_ACCESS_KEY_WRITE` | yes | H-005 | Write key for the solver wallet that publishes presence. |

## ci

Example: `.env.example`

| Name | Secret | Human task | Description |
| --- | --- | --- | --- |
| `GITHUB_REPO_URL` | no | H-001 | Public git remote. |
| `SEPOLIA_RPC_URL` | yes | H-003 | Sepolia HTTP RPC for fork tests. |
| `ETHERSCAN_API_KEY` | yes | H-007 | Etherscan API key for verification in CI. |
