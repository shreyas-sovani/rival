# Tools

| Tool | Use |
| --- | --- |
| Cursor coding agents | Slave tasks listed below, and this M-029 pass that filled the submission docs from the skeletons and the repo's deployment and spike notes. |
| Foundry (`forge`) | Build and test the contracts. Hook, settlement, solver, and ENS tests cited in `docs/spikes/S1.md`, `docs/spikes/S2.md`, and `docs/spikes/S3.md`. |
| Node, pnpm, `tsx` | Workspace scripts, the Arkiv S4 spike (`scripts/spikes/s4-arkiv.ts`), and `scripts/demo-live.ts`. |
| viem `2.57.16` and `@uniswap/permit2-sdk` `1.4.1` | Permit2 witness digest check in `docs/spikes/S2.md`. |
| `@arkiv-network/sdk` `1.0.1` | Schema definitions, `createEntity`, `extendEntity`, and the queries in `docs/spikes/S4.md`. |

# Generated changes

Recorded 2026-11-06 for the slave pass on `main` (`6480f04`). A person has not checked this statement. The MIT holder is Shreyas Sovani.

- S-001 monorepo scaffold, toolchain, and vendored Foundry libs (`contracts/DEPS.md`)
- S-002 backlog, territory, and freeze command-line tools
- S-003 CI workflows, PR template, CODEOWNERS, `.gitattributes`, MIT license file. The holder is Shreyas Sovani.
- S-005 `TestToken` and `TestToken.t.sol`
- S-008 display formatters, `sanitizeDisplayText`, and `testIds`
- S-014 Arkiv client factory and read-key rotation
- S-015 `withRetry` and `createRpcPool`
- S-018 `docs/architecture.md` and the submission skeletons
- Sepolia ETH sends recorded under H-002 in `BACKLOG.md` and `CONTRIBUTING.md`
- S-004 env examples and `scripts/env-check.ts`
- S-006 Next static shell, local fonts, route shells (audit of framework hosts still open)
- S-007 design-system primitives and the axe catalog
- S-009 presentational views
- S-010 static copy checked against `PRD.md`
- S-012 runner shell (smoke still blocked on unconfigured probes)
- S-013 generated ABIs and `loadDeployments`
- S-016 and S-017 CLI wrappers
- S-019 verify, egress, preflight, and `THIRD_PARTY.md`
- S-020 Vercel headers and `scripts/check-headers.mjs`

M-029, written from the skeletons on 2026-11-06, replaced the submission placeholders in `README.md`, `FEEDBACK.md`, `AI_USAGE.md`, `RUNBOOK.md`, and `arkiv/*.md` using `deployments/sepolia.json`, `docs/demo.md`, `docs/oracle.md`, `docs/ens-design.md`, and `docs/spikes/S1.md` through `S4.md`.

# Human review

A person has not checked this file. The license holder is unset.
