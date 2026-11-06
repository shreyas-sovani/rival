# Rival — BACKLOG (for coding agents)

> Source of truth for *what* to build: `PRD.md` (v3). Source of truth for *who does what, in what order, and how we prove it*: **this file**.
> Two coding agents work in parallel and **never talk to each other**. They coordinate only through (1) file ownership, (2) frozen interface files, (3) the `STATE` lines in this file. One human (the **FOUNDER**) handles every manual step.

Clock: **H0 = Fri 6 Nov 2026 02:00 IST**. Deadline: **Sat 7 Nov 09:00 IST = H+31**. Freeze for new work: **H+28 (Sat 06:00)**. Times below (`H+n`) are *targets*, not permissions to skip proof.

---

## 0. Which agent are you? (read this first)

You were started with one of two roles. Your role determines everything you may touch.

| Role | Nature of work | May write | Must never |
| --- | --- | --- | --- |
| **MASTER** | All **logic**: contracts, math, oracle, settlement, ENS/Arkiv semantics, solver strategies, runner handlers, data layer, wiring, tests of logic, spike reports, final docs content | Everything in the **MASTER territory** (§2) and *its own task blocks* here | Edit SLAVE-territory files (ask for rework via `STATE: REWORK`, §6.4) |
| **SLAVE** | Pure **labour**: scaffolding, config, boilerplate, generators, tooling, presentational UI, CLI wrappers, doc skeletons, scripts | Only the **SLAVE territory** (§2) and *its own task blocks* here | Write any logic (§1), touch MASTER files, invent interfaces, edit frozen files, guess |

**If you are MASTER:** start at §3 (Boot), then work §7 (M-tasks) in order, honouring §5 (human gates).
**If you are SLAVE:** start at §3 (Boot), then work §8 (S-tasks) in order; stop when idle (§4.6).
Humans: see §9 (H-tasks). Agents print a **`HUMAN ACTION REQUIRED`** block (format in §5) whenever they hit a human task.

---

## 1. What counts as "logic" (SLAVE must not write it)

A task is *logic* — and belongs to MASTER — if it involves any of:

- price/curve/TWAP/improvement math, rounding, bps, decimals, token ordering;
- hashing, signatures, EIP-712 / Permit2 typed data, nonces, replay protection;
- settlement, gating, solver selection, profitability, strategy, timing decisions;
- oracle/hook semantics, ENS roles/registration/records semantics, Arkiv query semantics or schema fields;
- validation rules (what makes an intent valid), rate-limit *policy values*, fallback/degradation decisions;
- anything whose correctness a test must prove against the PRD's invariants (I1–I10).

SLAVE writes only: config files, scaffolding, typed wrappers *generated from frozen artifacts*, presentational components that render props, pure display formatting, CLI argument parsing/printing, generic infrastructure (retry/backoff/rotation, logging, SQLite plumbing), CI, doc *skeletons*, and scripts specified step-by-step in this file.

**When in doubt: it is logic. Mark the task `BLOCKED` with `BLOCKED-BY: needs-master-decision` and move on.**

---

## 2. Territories (strict, disjoint) and shared files

Paths not listed are **MASTER** by default. `pnpm territory:check` (built in S-002) fails the commit if you stage a file outside your territory.

### 2.1 SLAVE territory

```
package.json (root), pnpm-workspace.yaml, .npmrc, .nvmrc, tsconfig.base.json, .eslintrc*/eslint.config.*, .prettierrc*, .editorconfig, .gitignore, .gitattributes
commitlint.config.*, .githooks/**, CODEOWNERS, LICENSE, THIRD_PARTY.md, CONTRIBUTING.md, .github/** (all workflows/templates)
contracts/foundry.toml, contracts/remappings.txt, contracts/DEPS.md, contracts/lib/** (forge installs), contracts/src/tokens/TestToken.sol, contracts/test/TestToken.t.sol
scripts/backlog.ts, scripts/territory-check.ts, scripts/freeze-check.ts, scripts/freeze-write.ts, scripts/env-check.ts, scripts/verify-deployments.ts,
scripts/audit-egress.ts, scripts/egress-allowlist.json, scripts/check-headers.mjs, scripts/preflight.ts, scripts/preflight.config.ts, scripts/gen-abis.ts, scripts/licenses-table.ts, lighthouserc.json
.env.example, apps/*/.env.example, solver-template/.env.example, docs/ENV.md
apps/web/next.config.*, apps/web/tailwind.config.*, apps/web/postcss.config.*, apps/web/vercel.json, apps/web/components.json,
apps/web/src/app/layout.tsx, apps/web/src/app/globals.css, apps/web/src/app/**/page.shell.tsx
apps/web/src/components/ui/**          (design-system primitives)
apps/web/src/components/views/**       (presentational views: props only)
apps/web/src/lib/format.ts, apps/web/src/lib/sanitize.ts, apps/web/src/testids.ts
apps/web/src/content/**                (static copy for Evidence / Run-a-solver / disclaimers)
apps/web/e2e/support/**, apps/web/e2e/smoke.spec.ts, apps/web/e2e/a11y.spec.ts, apps/web/playwright.config.ts   (config, fixtures, page objects, smoke+a11y specs; all OTHER e2e specs are MASTER)
apps/runner/tsconfig.json, apps/runner/Dockerfile, apps/runner/fly.toml
apps/runner/src/server.ts, apps/runner/src/config.ts, apps/runner/src/logger.ts, apps/runner/src/db.ts, apps/runner/src/middleware/**, apps/runner/src/routes/**, apps/runner/src/sse.ts
packages/*/tsconfig.json, packages/*/vitest.config.ts
packages/chain/src/generated/**, packages/chain/src/deployments.ts           (generated / schema-typed loaders)
packages/arkiv/src/client.ts, packages/arkiv/src/rotation.ts
packages/solver-sdk/src/rpc-pool.ts, packages/solver-sdk/src/retry.ts
solver-template/README.md, solver-template/bin/**
scripts/cli/** (argument parsing/printing wrappers only)
docs/architecture.md, README.skeleton.md, FEEDBACK.skeleton.md, AI_USAGE.skeleton.md, RUNBOOK.skeleton.md, arkiv/*.skeleton.md
```

### 2.2 MASTER territory (everything else, notably)

```
contracts/src/** (except tokens/TestToken.sol), contracts/test/** (except TestToken.t.sol), contracts/script/**
packages/intent/**, packages/arkiv/src/** (except client.ts, rotation.ts), packages/solver-sdk/src/** (except rpc-pool.ts, retry.ts)
packages/chain/src/** (except generated/** and deployments.ts)
apps/runner/src/handlers/**, apps/runner/src/services/**, apps/runner/src/bots/**
apps/web/src/viewmodels/**, apps/web/src/data/**, apps/web/src/app/**/page.tsx, apps/web/src/hooks/**, apps/web/src/wallet/**
scripts/pools-deploy.ts, scripts/ens-*.ts, scripts/seed.ts, scripts/deploy.ts, scripts/spikes/**
specs/**, docs/spikes/**, docs/oracle.md, docs/ens-design.md, README.md, FEEDBACK.md, AI_USAGE.md, RUNBOOK.md, arkiv/*.md (final), deployments/**
```

### 2.3 Shared files

**(a) `package.json` files and `pnpm-lock.yaml` — dependency edits only, either agent.** SLAVE *creates* each `package.json` (S-001/S-006/S-012/…). After that, **either agent may change only the `dependencies`, `devDependencies` and `peerDependencies` keys** (via `pnpm add`/`pnpm remove` in the package they work in) and the lockfile. Scripts, names, exports and any other key remain SLAVE's; if MASTER needs a new script or field, set the relevant S-task to `REWORK`. `territory:check` allows a `package.json` change only if the JSON diff touches those three keys. Lockfile conflicts: `git checkout --theirs pnpm-lock.yaml && pnpm install`, then commit.

**(b) `BACKLOG.md`.**

Each agent edits **only the task blocks it owns** (`OWNER:` line), and only the fields `STATE`, `PROOF`, `BLOCKED-BY`, `NOTES`, `STARTED`. MASTER may additionally set `STATE: REWORK` + `REWORK-REASON` on a SLAVE block (§6.4). Never reformat or reorder the file. Git merges disjoint blocks cleanly.

### 2.4 Hand-offs (territory changes over time)

- `README.skeleton.md` etc. (SLAVE) → MASTER copies content into `README.md` (MASTER) during M-029. SLAVE never edits `README.md`.
- `apps/web/src/app/**/page.shell.tsx` (SLAVE; static shells) → MASTER creates `page.tsx` that imports the shell's layout and views. SLAVE never creates `page.tsx`.

---

## 3. Boot sequence (both agents, every session)

1. `git pull --rebase origin main`
2. `pnpm install` (after S-001 is DONE; before that skip)
3. `pnpm freeze:check` (after S-002 + M-007 are DONE; before that skip). If it fails, **stop**: see §4.3.
4. `pnpm backlog:board` (after S-002 is DONE) — prints counts by state and lists your next unblocked task. Before S-002 is DONE, read §7/§8 manually.
5. Pick the **first task in your list** whose `STATE` is `TODO` or `REWORK` and whose dependencies are all `DONE`. Set `STATE: WORKING`, `STARTED: <ISO time>`, commit that single-line change immediately (`chore(backlog): <ID> working`) so the other agent and the human can see it.
6. Do the work. Run `VERIFY`. If it passes, set `STATE: DONE` and write `PROOF` (§6).
7. Repeat. If no task is startable, follow §4.6 (idle protocol).

---

## 4. Rules for both agents

### 4.1 Git protocol (no mismatches, no conflicts)

- Single repo, branch **`main`**. Both agents commit directly to `main` in small commits. Commit format: `master(M-014): <what>` or `slave(S-007): <what>`.
- Before every commit: `git pull --rebase origin main` → `pnpm territory:check` → your task's `VERIFY` (or the package-level check) → commit → `git push origin main`. If push is rejected: pull --rebase again; **never force-push**.
- If a rebase conflicts: it is almost always `BACKLOG.md` (or `pnpm-lock.yaml`: regenerate with `pnpm install`). Keep **both** sides' edits to *their own* task blocks; never resolve by deleting the other agent's lines. A conflict in any other file means a territory violation: abort the rebase (`git rebase --abort`), `git reset --soft origin/main`, unstage files outside your territory, and mark your task `BLOCKED` with `BLOCKED-BY: territory-conflict <path>`.
- MASTER may use short-lived branches for risky work but must merge to `main` before marking a task DONE.

### 4.2 Frozen interfaces (the mismatch-killer)

MASTER freezes six artifact sets at **C0 (target H+1.5)** by running `pnpm freeze:write --bump "C0"`, which writes `specs/FREEZE.json` (path + sha256 for each file, a `version` integer, and a changelog):

| Set | Files | Consumed by SLAVE for |
| --- | --- | --- |
| F1 | `contracts/src/interfaces/*.sol`, `contracts/src/Types.sol` | ABI generation (S-013), nothing else |
| F2 | `packages/arkiv/src/schemas.ts` | Nothing (SLAVE does not touch schemas); used for CLI display strings only |
| F3 | `specs/runner-api.json`, `apps/runner/src/handlers/types.ts`, `apps/runner/src/handlers/index.ts`, `apps/runner/src/services/index.ts` | Runner routes (S-012) |
| F4 | `apps/web/src/viewmodels/**` | Presentational views (S-009), page shells, e2e page objects |
| F5 | `specs/sdk-api.d.ts`, `specs/intent-api.d.ts` | CLI wrappers (S-016, S-017) |
| F6 | `specs/deployments.schema.json`, `specs/env.schema.json` | Typed deployments loader (S-013), env-check (S-004) |

**SLAVE may only build against FROZEN artifacts.** A SLAVE task that lists `INPUTS: F4` cannot start until `pnpm freeze:check` shows F4 present and valid.

### 4.3 Freeze-change protocol

- If `pnpm freeze:check` fails (hash mismatch, missing file): **SLAVE** stops the current task, sets `STATE: BLOCKED`, `BLOCKED-BY: freeze-changed v<n>`, continues with any unblocked task, and re-checks at the start of every task. **MASTER** must never change a frozen file without `pnpm freeze:write --bump "<reason>"`; after a bump MASTER lists affected SLAVE tasks by setting them `STATE: REWORK` with `REWORK-REASON` (§6.4).
- The SLAVE never "adapts" to a changed interface by editing logic; it regenerates or reworks only within its territory, and only after the bump is recorded.

### 4.4 No runtime mocks, no secrets, no TODOs

- No hard-coded results, no fake data in production paths. Test doubles/fixtures only under `**/__fixtures__/**`, `**/*.test.*`, `**/*.stories.*`, `contracts/test/**`. ESLint rule (S-001) forbids importing those from non-test code.
- Never print, log, or commit secrets. Secrets live in `.env.local` / platform secret stores, set by the human (§9). `pnpm env:check` only reports presence.
- Do not leave `TODO`, `FIXME`, `TBD`, `lorem` in files that ship. Skeleton markers use the token **`FILL(`** which `pnpm preflight` greps for.

### 4.5 When something is missing or ambiguous

Do **not** guess and do **not** message the other agent. Record it:

- SLAVE: `STATE: BLOCKED`, `BLOCKED-BY: <task id | needs-master-decision | needs-human H-xxx>`, one-line `NOTES`. Move to the next task.
- MASTER: if the PRD and a pinned dependency disagree, **source wins**; create `docs/spikes/spec-delta-<n>.md` describing the delta, bump the freeze if interfaces change, continue.
- Anything requiring the human: §5.

### 4.6 Idle protocol

When no task is startable: print exactly

```
IDLE (<ROLE>): blocked tasks = [<ID>: <BLOCKED-BY>, ...]. Waiting for <MASTER|FOUNDER> to unblock. No speculative work performed.
```

and stop. **Never invent work, never pre-write logic "to save time", never refactor the other territory.**

### 4.7 Time-boxing

Each task has `BUDGET`. At 150 % of budget, set `STATE: BLOCKED`, `BLOCKED-BY: over-budget`, write what was tried in `NOTES`, and move on. (MASTER: also write `docs/spikes/blocker-<ID>.md` listing options.)

---

## 5. Human gates (how agents ask the FOUNDER for manual steps)

Agents cannot do these; when a task needs one, set `BLOCKED-BY: needs-human H-xxx`, then **print this block verbatim** (filled) and continue with other work:

```
🛑 HUMAN ACTION REQUIRED [H-xxx] — <title>
WHY: <one sentence: what is blocked and what it unlocks>
DO THIS (≈<minutes> min):
  1. ...
  2. ...
RETURN: <exact files/variables to create, e.g. fill secrets/.env.local keys A,B,C>
CHECK: run `pnpm env:check --target <t>`  → expect "OK"
AFTER: reply "H-xxx done" (or edit this task's STATE to DONE)
```

Rules: the human puts every secret in **`secrets/.env.local`** (gitignored; never committed). The human marks `H-xxx` as DONE by editing its `STATE` line and adding `PROOF:` (what they did + date). Agents re-check `pnpm env:check` before treating a human task as done.

---

## 6. Provable states

### 6.1 States

| State | Meaning | Who sets it |
| --- | --- | --- |
| `TODO` | Not started | initial |
| `WORKING` | An agent is on it (with `STARTED`) | the owner |
| `BLOCKED` | Cannot proceed; `BLOCKED-BY` names the unblocker | the owner |
| `REWORK` | Previously DONE or WORKING, must be redone (`REWORK-REASON`) | MASTER (on SLAVE tasks) or the owner (on own) |
| `DONE` | Finished **with proof** | the owner, only after `VERIFY` passes |

### 6.2 What a valid `PROOF` is

`PROOF` is one or more lines, each:

```
PROOF: <git sha7> | <command run> | <result in ≤ 120 chars, e.g. "42 passed, 0 failed"> | <artifact path or URL, or "-">
```

DONE is **invalid** (and will be reverted to `REWORK` by `pnpm backlog:verify`) if: no PROOF; the sha is not on `main`; the `VERIFY` command re-run on the current tree fails; or the touched files violate the owner's territory.

### 6.3 `pnpm backlog:board` and `pnpm backlog:verify` (built in S-002)

- `backlog:board` prints per-state counts, per-owner next task, and every BLOCKED reason (sorted by blocker).
- `backlog:verify [--task ID] [--run]` parses task blocks; checks DONE ⇒ PROOF exists and sha is reachable; with `--run`, executes the task's `VERIFY` commands for tasks marked `AUTO: yes` and reports mismatches. Exit code ≠ 0 if any DONE task fails.
- Task block grammar (do not deviate):

```
### <ID> — <title>
- STATE: TODO|WORKING|BLOCKED|REWORK|DONE
- OWNER: MASTER|SLAVE|FOUNDER
- PRD: <refs>
- DEPENDS: <ids / frozen sets>
- INPUTS: <frozen sets / files that must exist>
- TOUCHES: <path globs>
- BUDGET: <hours>
- AUTO: yes|no
- DO: <bullets>
- VERIFY: <fenced bash>
- DONE-WHEN: <observable result>
- STARTED:
- PROOF:
- BLOCKED-BY:
- REWORK-REASON:
- NOTES:
```

### 6.4 Rework requests (the only cross-agent write)

If MASTER finds a SLAVE output wrong, it edits **only that block**: `STATE: REWORK`, `REWORK-REASON: <specific, testable>`. SLAVE picks REWORK tasks before TODO tasks. SLAVE never creates rework requests on MASTER tasks; it blocks its own tasks instead.

### 6.5 Command contract (root `package.json` scripts that must exist after S-001/S-002)

`lint`, `typecheck`, `test`, `forge:build`, `forge:test`, `gen:abis`, `backlog:board`, `backlog:verify`, `territory:check`, `freeze:check`, `freeze:write`, `env:check`, `verify:deployments`, `audit:egress`, `preflight`, `licenses:table`, `web:dev`, `web:build`, `web:preview`, `runner:dev`, `solver:init`, `solver:dev`, `cli:intent`, `cli:book`, `cli:verify`, `e2e`, `e2e:synthetic`.
Scripts whose logic belongs to MASTER start as stubs that **exit with code 3 and print `NOT_IMPLEMENTED(<owner task id>)`**, so a stub can never be mistaken for success.

---

## 7. MASTER backlog (logic; do in this order)

> Targets reference PRD checkpoints: C0 H+1.5 · C1 H+5 · C2 H+14 · C3 H+22 · C4 H+27.

### M-001 — Freeze F1: Solidity interfaces and shared types
- STATE: DONE
- OWNER: MASTER
- PRD: §7.1, FR-SET-*, FR-HOK-03, FR-ENS-02/05
- DEPENDS: —
- INPUTS: PRD §7.1
- TOUCHES: `contracts/src/interfaces/**`, `contracts/src/Types.sol`
- BUDGET: 0.7
- AUTO: yes
- DO:
  - Write `Types.sol` (`Intent`, `FillParams`, `Stats`, enums for `mode`/`gate`/status) exactly as PRD §7.1.
  - Write `IRivalSettlement`, `IRivalFill`, `IRivalOracle`, `ISolverRegistry`, `IRivalNames`, `IPermit2Min` (only the Permit2 functions we call). Import v4 types (`PoolKey`, `PoolId`) from the pinned `v4-core` — **read the pinned source, not memory**.
  - Natspec on every function (inputs, outputs, reverts).
- VERIFY:
  ```bash
  pnpm forge:build   # requires S-001
  ```
- DONE-WHEN: `forge build` succeeds with only interfaces/types present; ABI JSON exists in `contracts/out`.
- STARTED: 2026-11-06T03:55:00Z
- PROOF: 0729fc2 | pnpm forge:build | compilation skipped, ABIs present in contracts/out | contracts/out/IRivalSettlement.sol/IRivalSettlement.json
- BLOCKED-BY:
- NOTES: PoolKey/PoolId from `@uniswap/v4-core@1.0.2` git `59d3ecf`. Remapping `@uniswap/v4-core/=lib/v4-core/`. `setSettlement` is the one-time binder from PRD §9.4. Permit2 structs match pinned `PermitHash.sol`.

### M-002 — Freeze F2: Arkiv schemas
- STATE: DONE
- OWNER: MASTER
- PRD: §7.4, FR-ARK-01/03
- DEPENDS: —
- INPUTS: PRD §7.4; Arkiv docs (`/schemas/define.md`, `/reference/limits.md`)
- TOUCHES: `packages/arkiv/src/schemas.ts`, `specs/arkiv-queries.md`
- BUDGET: 0.5
- AUTO: yes
- DO:
  - Implement `IntentEntity` and `SolverPresence` with `defineSchema`; check names ≤ 32 bytes, `str` ≤ 128 bytes, ≤ 31 columns.
  - Write the five canonical queries in `specs/arkiv-queries.md` (copy PRD §7.4; adjust to the real grammar).
- VERIFY:
  ```bash
  pnpm --filter @rival/arkiv typecheck
  ```
- DONE-WHEN: Typechecks against `@arkiv-network/sdk@1.0.1`.
- STARTED: 2026-11-06T04:00:00Z
- PROOF: bd3bd63 | pnpm --filter @rival/arkiv typecheck | tsc --noEmit exit 0 | packages/arkiv/src/schemas.ts
- BLOCKED-BY:
- NOTES: 19 and 7 columns, under the 31-column named-schema cap. Queries adjusted to the 6 Nov 2026 grammar. `<now>` is an interpolated `u64`. Documented in `specs/arkiv-queries.md`.

### M-003 — Freeze F3: Runner API spec and handler types
- STATE: DONE
- OWNER: MASTER
- PRD: §7.5, FR-RUN-01..03, FR-ARK-05
- DEPENDS: —
- INPUTS: PRD §7.5
- TOUCHES: `specs/runner-api.json`, `apps/runner/src/handlers/types.ts`, `apps/runner/src/handlers/index.ts`, `apps/runner/src/services/index.ts`
- BUDGET: 0.6
- AUTO: yes
- DO:
  - `runner-api.json` (OpenAPI 3.1): `/api/health`, `/api/faucet`, `/api/intents`, `/api/cancel`, `/api/intents/stream` with request/response/error schemas and the error-code enum from §7.5.
  - `handlers/types.ts`: one function type per endpoint (`(req) => Promise<res>`), typed errors.
  - `handlers/index.ts`: exports an object with **every handler implemented as `throw new NotImplemented("M-0xx")`**. SLAVE routes import this.
  - `services/index.ts` (frozen contract for the server): `export async function startServices(): Promise<void>` and `export async function runCheck(): Promise<number>` (exit code), both initially `throw new NotImplemented("M-022")`. SLAVE's `server.ts` calls them.
- VERIFY:
  ```bash
  pnpm --filter @rival/runner typecheck
  ```
- DONE-WHEN: Types compile; every endpoint present exactly once in spec and handler map.
- STARTED: 2026-11-06T04:05:00Z
- PROOF: 8054ef9 | pnpm --filter @rival/runner typecheck | tsc --noEmit exit 0 | specs/runner-api.json
- BLOCKED-BY:
- NOTES: Five paths match the handler map. Domain errors keep the PRD status map. Stubs throw `NotImplemented` and routes must return HTTP 501.

### M-004 — Freeze F4: view models and route table
- STATE: DONE
- OWNER: MASTER
- PRD: FR-WEB-01..06, §3.2
- DEPENDS: —
- INPUTS: PRD §4.8, §5.5
- TOUCHES: `apps/web/src/viewmodels/**`
- BUDGET: 1.0
- AUTO: yes
- DO:
  - Define pure-data TypeScript interfaces (no functions except callback props) for each presentational view: `IntentComposerVM` (fields, presets, gate options, preview curve points, floor line, validation messages, `onChange`/`onSubmit` callbacks), `CurveChartVM` (series: required-out points, pool-quote line, TWAP line, hard-floor line, fill marker), `ReceiptVM`, `AuctionStatusVM`, `SolverRowVM`/`LeaderboardVM`, `BookRowVM`/`BookVM` (incl. generated query string), `EventVM`, `PresenceVM`, `BannerVM` (kind, text, action), `EvidenceVM`, `RunSolverVM`, `TxLinkVM`.
  - **All amounts are strings already formatted by MASTER's data layer except where a `bigint` + `decimals` pair is explicitly provided** (so views never do domain math).
  - Route table in `viewmodels/routes.ts`: `/` Trade, `/auction?h=<hash>` Live auction, `/solvers`, `/book`, `/solver`, `/evidence` (static-export friendly; no dynamic segments).
- VERIFY:
  ```bash
  pnpm --filter @rival/web typecheck
  ```
- DONE-WHEN: Typechecks; each PRD §5.5 step is renderable from these view models.
- STARTED: 2026-11-06T04:08:00Z
- PROOF: 903dcfa | pnpm --filter @rival/web typecheck | tsc --noEmit exit 0 | apps/web/src/viewmodels/routes.ts
- BLOCKED-BY:
- NOTES: Routes are `/`, `/auction?h=`, `/solvers`, `/book`, `/solver`, `/evidence`. Amounts are formatted strings.

### M-005 — Freeze F5: SDK and intent public APIs
- STATE: DONE
- OWNER: MASTER
- PRD: FR-SOL-02/04, §6.6
- DEPENDS: —
- INPUTS: PRD §4.4, §7.1, §7.2
- TOUCHES: `specs/sdk-api.d.ts`, `specs/intent-api.d.ts`
- BUDGET: 0.7
- AUTO: yes
- DO:
  - `intent-api.d.ts`: `buildIntent`, `hashIntent`, `permit2TypedData`, `requiredAt`, `receiptMath`, `verifyIntentSignature`, `presets`.
  - `sdk-api.d.ts`: `initSolver({label,key,rpc})`, `runSolver(config)`, `verifyFill(txHash)`, `watchIntents(opts)`, `getBook(query)`, `signAndPublish(opts)`; CLI flag schemas as TS types for `cli:intent`, `cli:book`, `cli:verify`, `solver:init`, `solver:dev`.
- VERIFY:
  ```bash
  pnpm exec tsc --noEmit specs/sdk-api.d.ts specs/intent-api.d.ts
  ```
- DONE-WHEN: `.d.ts` files compile.
- STARTED: 2026-11-06T04:10:00Z
- PROOF: 2983d52 | pnpm exec tsc --noEmit specs/sdk-api.d.ts specs/intent-api.d.ts | exit 0 | specs/intent-api.d.ts
- BLOCKED-BY:
- NOTES: `verifyIntentSignature` returns a promise. Improvement sentinel is `-2147483648`. `hashIntent` is the struct hash, not the Permit2 digest.

### M-006 — Freeze F6: deployments and env schemas
- STATE: DONE
- OWNER: MASTER
- PRD: §9.3, §9.4
- DEPENDS: —
- INPUTS: PRD §9
- TOUCHES: `specs/deployments.schema.json`, `specs/env.schema.json`
- BUDGET: 0.5
- AUTO: yes
- DO:
  - `deployments.schema.json`: chainId, tokens (tWETH, tUSDC), hook (address, flagBitsHex, salt), pools (A,B: poolId, fee, tickSpacing, currency0/1), settlement, registry, names, uniswapSolver(s), ENS addresses + parent label + registry address, solvers[] (label, address, strategy), arkiv writer addresses, runner URL, commit.
  - `env.schema.json`: for each *target* (`web-build`, `runner`, `operator`, `solver-template`, `ci`) the list of required variables with `secret: true|false`, description and the human task that provides it (PRD §9.3).
- VERIFY:
  ```bash
  pnpm exec ajv compile -s specs/deployments.schema.json && pnpm exec ajv compile -s specs/env.schema.json
  ```
- DONE-WHEN: Both schemas valid.
- STARTED: 2026-11-06T04:12:00Z
- PROOF: 51fd03e | pnpm exec ajv compile -s specs/deployments.schema.json && pnpm exec ajv compile -s specs/env.schema.json | both schemas valid | specs/env.schema.json
- BLOCKED-BY:
- NOTES: Draft-07 so default ajv accepts them. `writeOnly` means secret. `$comment` is `humanTask=H-xxx`. `NEXT_PUBLIC_RABDI_RPC` is the CSP host. No values are stored. ajv and typescript were added in `2ffdba7`.

### M-007 — C0: write the freeze and tag it
- STATE: DONE
- OWNER: MASTER
- PRD: §10.4 C0
- DEPENDS: M-001, M-002, M-003, M-004, M-005, M-006, S-002
- INPUTS: all of the above
- TOUCHES: `specs/FREEZE.json`
- BUDGET: 0.2
- AUTO: yes
- DO:
  - `pnpm freeze:write --bump "C0"`; commit; `git tag c0-frozen`; push tags.
  - **Print a HUMAN ACTION REQUIRED block for H-010 (C0 review).**
- VERIFY:
  ```bash
  pnpm freeze:check
  ```
- DONE-WHEN: `freeze:check` exits 0 and reports version 1 with F1–F6 listed.
- STARTED: 2026-11-06T07:00:00Z
- PROOF: 3605a85 | pnpm freeze:check | freeze OK v1 | specs/FREEZE.json
- BLOCKED-BY:
- NOTES: Tag `c0-frozen` points at `3605a85`. F1–F6 are listed. SLAVE tasks with `INPUTS: F*` unblock on this. H-010 C0 review is still open.

### M-010 — `packages/intent`: types, typed data, hashing, curve math, receipts, vectors
- STATE: DONE
- OWNER: MASTER
- PRD: FR-SET-01/02/06, §7.2, §7.3 (I3, I4)
- DEPENDS: S-001, M-005
- INPUTS: F1, F5
- TOUCHES: `packages/intent/**`
- BUDGET: 3.0
- AUTO: yes
- DO:
  - Implement exactly the math in PRD §7.2 (floorDiv/ceilDiv helpers, negative bps, clamp, truncation toward zero for improvement).
  - Intent EIP-712 struct hash + **Permit2 witness typed data** (spender = settlement). Use `@uniswap/permit2-sdk` as the oracle of truth for vector tests.
  - `vectors.json` generator: the PRD's worked table + ≥ 10,000 random vectors + edge cases (zero elapsed, elapsed ≥ decay, hardMinOut dominates, startBps = floorBps, negative bps, both token orders). Output committed.
  - Presets (Fast/Balanced/Patient) per FR-WEB-02.
- VERIFY:
  ```bash
  pnpm --filter @rival/intent test
  ```
- DONE-WHEN: Worked-example table passes; property tests (non-increasing curve, never below hard floor) pass.
- STARTED: 2026-11-06T04:16:00Z
- PROOF: 726fa0d | pnpm --filter @rival/intent test | vitest 4 passed; node:test 7 passed, 0 failed | packages/intent/vectors.json
- BLOCKED-BY:
- NOTES: 10012 vectors, one JSON object per line. Witness digest matches `@uniswap/permit2-sdk@1.4.1`. Math writeup is `docs/intent-math.md`. Solidity parity is M-011.

### M-011 — `RivalMath.sol` and parity with vectors
- STATE: DONE
- OWNER: MASTER
- PRD: FR-SET-02/06, §7.2
- DEPENDS: M-010, S-001
- INPUTS: F1, `packages/intent/vectors.json`
- TOUCHES: `contracts/src/libs/RivalMath.sol`, `contracts/test/RivalMath.t.sol`
- BUDGET: 1.5
- AUTO: yes
- DO:
  - Solidity implementation of curve and receipt math; Foundry test reading `vectors.json` via `vm.readFile`/`vm.parseJson` and asserting equality on all vectors.
- VERIFY:
  ```bash
  pnpm forge:test --match-contract RivalMathTest
  ```
- DONE-WHEN: 100 % of vectors equal TypeScript results.
- STARTED: 2026-11-06T06:40:00Z
- PROOF: 80e611b | pnpm forge:test --match-contract RivalMathTest | 1 passed, 0 failed, gas 520157792 | contracts/test/RivalMath.t.sol
- BLOCKED-BY:
- NOTES: The file is read a line at a time because the full document does not fit in the EVM. Every row matched, including the worked example.

### M-012 — `RivalOracleHook`, reference model, mining script (spike S1 inside)
- STATE: DONE
- OWNER: MASTER
- PRD: FR-HOK-01..04, §6.5, K2
- DEPENDS: S-001, M-001
- INPUTS: F1; pinned v4-core/periphery; `uniswapfoundation/v4-template` for structure
- TOUCHES: `contracts/src/hook/**`, `contracts/test/hook/**`, `packages/intent/src/oracle-model.ts`, `scripts/spikes/s1-hook.ts`, `docs/oracle.md`, `docs/spikes/S1.md`
- BUDGET: 4.0
- AUTO: yes
- DO:
  - Implement `afterInitialize` + `beforeSwap` only; block-start-tick observations; `consult`, `quote`, `oldestTimestamp`; ring buffer 256; `beforeSwap` never reverts.
  - TypeScript reference model replaying random swap/time sequences; Foundry fuzz compares exactly.
  - Manipulation tests (same block: zero effect; k blocks: bounded shift).
  - HookMiner script; flag-bit assertion; pool initialization on a Sepolia fork.
  - Write `docs/spikes/S1.md` with the go/no-go decision (K2 threshold in PRD §13.2).
- VERIFY:
  ```bash
  pnpm forge:test --match-path "test/hook/*" && pnpm --filter @rival/intent test -- oracle
  ```
- DONE-WHEN: Model parity on 1,000 random sequences; manipulation tests pass; fork test initializes the hooked pool.
- STARTED: 2026-11-06T07:20:00Z
- PROOF: bd38489 | forge test --match-path "test/hook/*" | 11 passed, 0 failed, fork initialized PoolManager | docs/spikes/S1.md
- BLOCKED-BY:
- NOTES: **C1 gate input.** K2 GO. Flag mask 0x1080. 1000-sequence parity passed. Same-block manipulation does not move consult. Vendored solmate Owned.sol because the v4-core submodule checkout was empty.

### M-013 — Pools, tokens deployment and liquidity scripts
- STATE: DONE
- OWNER: MASTER
- PRD: FR-VEN-01/02
- DEPENDS: S-005, M-012, H-003 (funded operator), M-006
- INPUTS: F6
- TOUCHES: `scripts/pools-deploy.ts`, `contracts/script/DeployVenue.s.sol`, `deployments/sepolia.json`
- BUDGET: 2.0
- AUTO: no
- DO:
  - Deploy `TestToken` ×2, deploy hook at the mined address, initialize Pool A (fee 500, tickSpacing 10, hooked) and Pool B (fee 3000, tickSpacing 60), add liquidity (PRD FR-VEN-02), write `deployments/sepolia.json` validating against F6 schema.
- VERIFY:
  ```bash
  pnpm verify:deployments --only venue
  ```
- DONE-WHEN: Both pools return expected slot0 via StateView; Quoter returns sane quotes both directions.
- STARTED: 2026-11-06T09:25:00Z
- PROOF: e64c447 | pnpm exec tsx scripts/pools-deploy.ts --broadcast | schema ok; slot0 true; quotes true | deployments/sepolia.json
- BLOCKED-BY:
- NOTES: First two creates ran out of gas and deployed no code. The broadcast that landed used an 800 percent gas estimate. Pool A and Pool B share sqrt price 4339505179874779489431521 and tick -196257. Settlement, registry, names, and ENS addresses in the JSON are zero placeholders.

### M-014 — `RivalSettlement` (+ invariants I1–I10) — spike S2 inside
- STATE: DONE
- OWNER: MASTER
- PRD: FR-SET-01..06, §7.3, §8.3, K3, K4
- DEPENDS: M-011, M-012, M-001
- INPUTS: F1; Permit2 source; UniswapX `ReactorStructs/OrderLib` as pattern
- TOUCHES: `contracts/src/RivalSettlement.sol`, `contracts/test/settlement/**`, `docs/spikes/S2.md`
- BUDGET: 6.0
- AUTO: yes
- DO:
  - Implement `fill`, `cancel`, `cancelBySig`, `requiredAt`, gating hooks into registry, receipts, `nonReentrant`, delivery balance-delta check, `SelfFill`.
  - Validate Permit2 witness signatures **from viem** (spike S2): write `docs/spikes/S2.md` with result; if mismatch unresolved by H+8 follow K3.
  - Invariant suite I1–I10; attack-catalog tests §8.3 (#1,2,6,7,8,9,11,12,13,21,22,23).
- VERIFY:
  ```bash
  pnpm forge:test --match-path "test/settlement/*" --fuzz-runs 10000
  ```
- DONE-WHEN: All listed tests green at 10,000 runs; Slither shows no unaddressed high/medium.
- STARTED: 2026-11-06T07:55:00Z
- PROOF: 15426a6 | forge test --match-path "test/settlement/*" --fuzz-runs 10000 | 24 passed, 0 failed | docs/spikes/S2.md
- BLOCKED-BY:
- NOTES: K3 GO. Witness matches viem and permit2-sdk. Fills in tests use LocalPermit2 because pinned Permit2 is solc 0.8.17 and its solmate checkout is empty. cancelBySig cannot check the signer against the maker: the frozen call has no maker argument, so any valid signature cancels a known hash. Slither is not installed; M-025 still owns the Slither report.

### M-015 — `UniswapSolver` (flash accounting fill contract)
- STATE: DONE
- OWNER: MASTER
- PRD: FR-SOL-01
- DEPENDS: M-014, M-013
- INPUTS: F1; v4-core unlock/settle/take patterns
- TOUCHES: `contracts/src/solver/UniswapSolver.sol`, `contracts/test/solver/**`
- BUDGET: 2.5
- AUTO: yes
- DO:
  - Callback-only-by-settlement; exact-input swap through PoolManager; settle/take; approve exactly `requiredOut`; owner sweep; fork tests via Pool A and Pool B.
- VERIFY:
  ```bash
  pnpm forge:test --match-path "test/solver/*" --fork-url $SEPOLIA_RPC_URL
  ```
- DONE-WHEN: End-to-end fill on a Sepolia fork via both pools; caller-restriction test passes.
- STARTED: 2026-11-06T08:55:00Z
- PROOF: 014da4a | forge test --match-path "test/solver/*" | 5 passed, 0 failed, fork filled both pools | contracts/src/solver/UniswapSolver.sol
- BLOCKED-BY:
- NOTES: Callback reverts unless the caller is settlement. Fork maker key skips addresses that already have code, because Permit2 then uses EIP-1271.

### M-016 — `SolverRegistry` + `RivalNames` (spike S3 inside)
- STATE: DONE
- OWNER: MASTER
- PRD: FR-ENS-02..06, FR-SET-04, K1
- DEPENDS: M-001, S-001, H-006 (ENS parent plan) 
- INPUTS: F1; ENS contracts-v2 pinned; ENS docs (Permissioned Registry, EAC, Resolver, contract tutorial)
- TOUCHES: `contracts/src/SolverRegistry.sol`, `contracts/src/ens/**`, `contracts/test/ens/**`, `docs/ens-design.md`, `docs/spikes/S3.md`
- BUDGET: 5.0
- AUTO: yes
- DO:
  - Spike S3 first (register/ownerOf/unregister/renew from a contract; non-transferable; per-record protection; renounce). Write result in `docs/spikes/S3.md`; choose primary vs fallback (FR-ENS-06).
  - Implement registry (deposit, one name per solver, reserved labels, stats, `isListed`, `ownsAny`, `onFill`, `exit`, lapse) and names glue (issue, renew on fill, `syncRecords`, records).
  - Tests: stub-ENS revert cases, fork tests, stale-id, lapse with short TTL fixture, forged-record revert.
- VERIFY:
  ```bash
  pnpm forge:test --match-path "test/ens/*" --fork-url $SEPOLIA_RPC_URL
  ```
- DONE-WHEN: FR-ENS-02/03/04/05 acceptance tests pass on fork; S3 report committed.
- STARTED: 2026-11-06T07:20:00Z
- PROOF: 8dd5269 | forge test --match-path "test/ens/*" --fork-url $SEPOLIA_RPC_URL | 25 passed, 0 failed, 0 skipped | docs/spikes/S3.md
- BLOCKED-BY:
- NOTES: **C1 gate input** (K1). Decision FALLBACK (b): com.rival.* stored on RivalNames; isListed uses ownerOf and fails closed. Skip H-006; do not buy rival.eth. Parent only matters later if solvers.<parent>.eth must resolve in the Sepolia ENS app.

### M-017 — ENS bootstrap and role-check scripts
- STATE: DONE
- OWNER: MASTER
- PRD: FR-ENS-01
- DEPENDS: M-016, H-003, H-006
- INPUTS: ENS Deployments page (re-read on the day)
- TOUCHES: `scripts/ens-bootstrap.ts`, `scripts/ens-role-check.ts`
- BUDGET: 2.0
- AUTO: no
- DO:
  - Register parent (or use the label the human acquired), create `solvers` registry, grant roles, write addresses to `deployments/sepolia.json`; role-check prints a table and exits non-zero on any unexpected role.
- VERIFY:
  ```bash
  pnpm exec tsx scripts/ens-role-check.ts --expect specs/ens-roles.expected.json
  ```
- DONE-WHEN: Role table equals expected; resolution of `solvers.<PARENT>.eth` works in viem.
- STARTED: 2026-11-06T07:50:00Z
- PROOF: 72a73d1 | pnpm exec tsx scripts/ens-role-check.ts --expect specs/ens-roles.expected.json | result ok, exit 0 | deployments/sepolia.json
- BLOCKED-BY:
- NOTES: Solvers registry 0xCEec9D7ADcad00e4D842283d9526E75C9440b36f. RivalNames 0xC20a61e830bB91A69C1B6BCcd607299152aDE797 holds 0x11001. SolverRegistry 0x6AD5C78fA2278d397Bb7e04e1e2266Cc39a1109E. solvers.rival.eth does not resolve because rival.eth was not bought. H-006 stays skipped.

### M-018 — Full deployment script and verification
- STATE: TODO
- OWNER: MASTER
- PRD: §9.4
- DEPENDS: M-013, M-014, M-015, M-016, M-017, H-007
- INPUTS: F6
- TOUCHES: `scripts/deploy.ts`, `contracts/script/Deploy.s.sol`, `deployments/sepolia.json`
- BUDGET: 2.0
- AUTO: no
- DO:
  - Orchestrate §9.4 order; one-time `registry.setSettlement`; Etherscan verification; register solvers; set ENSIP-25/26 records for bots/house.
- VERIFY:
  ```bash
  pnpm verify:deployments
  ```
- DONE-WHEN: Every address has code; Etherscan verified; JSON validates against F6.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES: **Produces the first full Sepolia stack (C2 prerequisite).**

### M-019 — `packages/arkiv`: publish, query, presence, patch, payload verification (spike S4)
- STATE: DONE
- OWNER: MASTER
- PRD: FR-ARK-01..05, §7.4
- DEPENDS: M-002, S-014, H-005
- INPUTS: F2; Arkiv docs
- TOUCHES: `packages/arkiv/src/**` (except `client.ts`, `rotation.ts`), `scripts/spikes/s4-arkiv.ts`, `docs/spikes/S4.md`, `arkiv/friction.md`
- BUDGET: 3.0
- AUTO: yes
- DO:
  - Spike S4 first: runner write+read, browser CORS, `u256` filters, `BETWEEN`, presence `extendEntity` at 60 s cadence, tGLM cost; decide K6.
  - Implement `publishIntent`, `queryOpenIntents`, `countPresence`, `upsertPresence`, `patchStatus`, `verifyPayload` (recompute hash + signature), query-string builders.
  - Append real friction entries to `arkiv/friction.md` as you go.
- VERIFY:
  ```bash
  pnpm --filter @rival/arkiv test && pnpm exec tsx scripts/spikes/s4-arkiv.ts --check
  ```
- DONE-WHEN: Entity written by publisher is queryable within 8 s; presence expires without cleanup; forged payload rejected.
- STARTED: 2026-11-06T07:20:00Z
- PROOF: a2423f0 | pnpm --filter @rival/arkiv test | 20 passed, 0 failed | docs/spikes/S4.md
- BLOCKED-BY:
- NOTES: **C1 gate input** (K6). K6 GO. Rabdi write 6761 ms, query hit 1005 ms, u256 BETWEEN hit, presence extend 6092 ms, tGLM spent 0.000456736. Forged payload rejected in book.test.ts. Browser CORS was not called. Three-minute presence expiry was not waited out.

### M-020 — Solver SDK: watcher, verifier, quote/cost engine, strategies, submitter
- STATE: BLOCKED
- OWNER: MASTER
- PRD: FR-SOL-02/03, §8.2 (tx lifecycle)
- DEPENDS: M-010, M-014, M-015, M-019, S-015
- INPUTS: F1, F5
- TOUCHES: `packages/solver-sdk/src/**` (except `rpc-pool.ts`, `retry.ts`)
- BUDGET: 5.0
- AUTO: yes
- DO:
  - Intent watcher (Arkiv) + local signature/nonce/cancel/balance verification; profitability using v4 Quoter + gas; strategies `sprint`, `patient`, `arb`, `inventory`, `house`; submitter with simulate → send → replace-by-fee → give up at deadline; presence heartbeat; per-key nonce manager.
  - Unit tests with recorded real responses (test dirs only).
- VERIFY:
  ```bash
  pnpm --filter @rival/solver-sdk test
  ```
- DONE-WHEN: Against a Sepolia fork, each strategy fills a seeded intent at its intended point on the curve.
- STARTED: 2026-11-06T08:10:00Z
- PROOF: 4779123 | pnpm --filter @rival/solver-sdk test && pnpm --filter @rival/solver-sdk typecheck | 23 passed, 0 failed | packages/solver-sdk/src/strategies.ts
- BLOCKED-BY: no settlement transaction
- NOTES: dbf6716 | 35 unit tests pass. Live Quoter at block 12075841: 1 tWETH pays 2998350157 on pool A and 2990850906 on pool B. Sprint, patient, inventory, and house decide to fill. Arb does not, because pool B is below pool A. No fill transaction was sent.

### M-021 — Runner handlers: publisher, faucet, cancel relay, stream, health
- STATE: DONE
- OWNER: MASTER
- PRD: FR-RUN-01..03, FR-ARK-05, §7.5
- DEPENDS: M-003, M-010, M-019, S-012
- INPUTS: F3
- TOUCHES: `apps/runner/src/handlers/**` (replace stubs), `apps/runner/src/services/**`
- BUDGET: 4.0
- AUTO: yes
- DO:
  - Implement every handler to the F3 contract: intent validation (FR-RUN-02 incl. oracle sanity guard and house-solver simulation), faucet (EIP-712 `FaucetClaim`, limits), `cancelBySig` relay, SSE degraded feed, health aggregation.
  - Keep handler signatures **unchanged** (they are frozen).
- VERIFY:
  ```bash
  pnpm --filter @rival/runner test
  ```
- DONE-WHEN: Contract tests for each endpoint incl. error codes; forged/expired/insufficient-balance intents rejected.
- STARTED: 2026-11-06T07:50:00Z
- PROOF: 5eda660 | pnpm --filter @rival/runner test && pnpm --filter @rival/runner typecheck | 32 passed, 0 failed | apps/runner/src/handlers/handlers.test.ts
- BLOCKED-BY:
- NOTES: Signatures in handlers/types.ts are unchanged. services/index.ts still throws NotImplemented for M-022. Freeze bumped because handlers/index.ts is in F3.
- NOTES:

### M-022 — Runner services: indexer, market maker, maker bots, solver bots, orchestration
- STATE: TODO
- OWNER: MASTER
- PRD: FR-VEN-03, FR-ARK-02/03, FR-SOL-02/03, FR-RUN-03
- DEPENDS: M-018, M-019, M-020, M-021, H-004, H-008
- INPUTS: deployed stack
- TOUCHES: `apps/runner/src/services/**`, `apps/runner/src/bots/**`
- BUDGET: 5.0
- AUTO: no
- DO:
  - Indexer (status patcher), market maker + heartbeat (F_t walk, A/B basis), maker bots (labeled), five solver bots + house, throttles for ETH runway (K5), health signals.
- VERIFY:
  ```bash
  pnpm runner:dev --check   # runs one full cycle against Sepolia and exits 0 on success
  ```
- DONE-WHEN: 1-hour soak: oracle freshness ≥ 95 %; ≥ 3 distinct solvers fill; no manual intervention.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES: **C2 vertical slice depends on this.**

### M-023 — Web data layer: wallet, signing, quotes, book, auction, leaderboard
- STATE: DONE
- OWNER: MASTER
- PRD: FR-WEB-01..05, FR-ENS-05 (reads)
- DEPENDS: M-004, M-010, M-018, M-019, S-013
- INPUTS: F4, F5, F6
- TOUCHES: `apps/web/src/data/**`, `apps/web/src/hooks/**`, `apps/web/src/wallet/**`
- BUDGET: 5.0
- AUTO: yes
- DO:
  - IndexedDB AES-GCM wallet; typed-data signing with plain-language summary; Quoter/hook quote reads; TWAP; Arkiv queries; chain event subscription; ENS reads via UniversalResolverV2; adapters producing **F4 view models**. Curve preview uses `packages/intent` only.
- VERIFY:
  ```bash
  pnpm --filter @rival/web test
  ```
- DONE-WHEN: Preview curve equals contract `requiredAt` at 20 timestamps; no key ever appears in network requests (test).
- STARTED: 2026-11-06T08:55:00Z
- PROOF: cbe8b41 | pnpm --filter @rival/web test && pnpm --filter @rival/web typecheck | 21 passed, 0 failed | apps/web/src/data/curve.test.ts
- BLOCKED-BY:
- NOTES: Curve preview matches requiredAt at 20 timestamps. The plaintext key is absent from mocked fetch URLs and bodies. Wallet storage is an injected port, not IndexedDB yet. Live Quoter, hook TWAP, ENS, and auction subscriptions wait on a deployment.

### M-024 — Web wiring: pages assemble SLAVE views with data
- STATE: TODO
- OWNER: MASTER
- PRD: FR-WEB-02..06, §5.5
- DEPENDS: M-023, S-006, S-009, S-010
- INPUTS: F4
- TOUCHES: `apps/web/src/app/**/page.tsx`
- BUDGET: 3.0
- AUTO: yes
- DO:
  - Create `page.tsx` for each route importing the shell/layout and views; pass view models from hooks; handle loading/error/degraded states with `BannerVM`.
  - If a view is missing a prop you need, **do not edit the SLAVE file**: bump the freeze and mark that S-task `REWORK` (§6.4).
- VERIFY:
  ```bash
  pnpm web:build && pnpm e2e --grep "@smoke"
  ```
- DONE-WHEN: Static export builds; smoke e2e passes against `web:preview`.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES:

### M-025 — Parity, invariants completion, Slither
- STATE: TODO
- OWNER: MASTER
- PRD: §11.1–11.3, AT-05/06/08
- DEPENDS: M-011, M-012, M-014, M-016
- INPUTS: all contracts
- TOUCHES: `contracts/test/**`, `scripts/spikes/**`, `docs/spikes/slither.md`
- BUDGET: 3.0
- AUTO: yes
- DO:
  - Complete I1–I10 at ≥ 10,000 runs; negative cases §11.3; oracle manipulation demo on fork; Slither run and triage report.
- VERIFY:
  ```bash
  pnpm forge:test --fuzz-runs 10000 && slither contracts --config-file contracts/slither.config.json
  ```
- DONE-WHEN: All green; Slither: no unaddressed high/medium.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES:

### M-026 — Soak, calibration, K8 decision (spike S5/S6)
- STATE: TODO
- OWNER: MASTER
- PRD: FR-VEN-03, FR-SOL-03, §8.4, K5, K8
- DEPENDS: M-022
- INPUTS: running runner
- TOUCHES: `apps/runner/src/bots/config.*`, `docs/spikes/S5.md`, `docs/spikes/S6.md`
- BUDGET: 4.0
- AUTO: no
- DO:
  - 6-hour soak then 24-hour soak; tune MM basis, solver margins, house floor; measure gas per tx and ETH burn; produce reports with numbers.
- VERIFY:
  ```bash
  pnpm exec tsx scripts/spikes/soak-report.ts --hours 6
  ```
- DONE-WHEN: ≥ 98 % fill rate (floor ≤ −25 bps, size ≤ 10 tWETH); ≥ 3 distinct fillers; budget fits available ETH.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES: **C3 gate input.**

### M-027 — E2E flows, synthetic monitor, failure drills
- STATE: TODO
- OWNER: MASTER
- PRD: §11.2 AT-01/15, FR-OPS-01
- DEPENDS: M-024, S-011, M-022
- INPUTS: page objects (S-011)
- TOUCHES: `apps/web/e2e/**/*.spec.ts`
- BUDGET: 3.0
- AUTO: no
- DO:
  - Specs: happy path (tokens → sign → fill → receipt → leaderboard), gated intents, cancel, degraded Arkiv (block host), runner down, oracle stale, ENS read failure, direct CLI path; `e2e:synthetic` (30-min cadence).
- VERIFY:
  ```bash
  pnpm e2e
  ```
- DONE-WHEN: Suite green on production URL with a clean profile.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES:

### M-029 — Final docs content (README with line map, FEEDBACK.md, arkiv/*.md, evidence)
- STATE: TODO
- OWNER: MASTER
- PRD: §12
- DEPENDS: S-018, M-018, M-019, M-026
- INPUTS: skeletons (S-018), measured numbers
- TOUCHES: `README.md`, `FEEDBACK.md`, `AI_USAGE.md`, `RUNBOOK.md`, `arkiv/*.md`
- BUDGET: 3.0
- AUTO: yes
- DO:
  - Replace every `FILL(` marker with real content; write the **Uniswap integration line map** with real file:line links at the release commit; list writer addresses and a runnable query; honest limitations; third-party table with the BUSL note.
- VERIFY:
  ```bash
  pnpm preflight --only docs
  ```
- DONE-WHEN: `grep -R "FILL(" README.md FEEDBACK.md AI_USAGE.md RUNBOOK.md LICENSE arkiv` returns nothing (LICENSE holder resolved via H-001); links resolve.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES:

### M-030 — Preflight completion and clean-environment E2E
- STATE: TODO
- OWNER: MASTER
- PRD: §9.6, AT-12
- DEPENDS: M-027, M-029, S-019, H-011
- INPUTS: preflight skeleton (S-019)
- TOUCHES: `scripts/spikes/**` (workflows live in `.github/**`, which is SLAVE's; request changes via `REWORK` on S-003)
- BUDGET: 3.0
- AUTO: no
- DO:
  - Implement the master-owned preflight checks (oracle history, gate demos, ENS role report, lapse drill, Arkiv drills, parity); run the whole stack deploy into a **second namespace** and execute E2E.
- VERIFY:
  ```bash
  pnpm preflight
  ```
- DONE-WHEN: All 19 checks of PRD §9.6 pass.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES:

---

## 8. SLAVE backlog (pure labour; do in this order, stop when idle)

> Every S-task lists `INPUTS`. If an input is not present/frozen, **do not start**; mark `BLOCKED`.

### S-001 — Monorepo scaffold and toolchain pins
- STATE: DONE
- OWNER: SLAVE
- PRD: §9.1, §10.2 (rules 3,5)
- DEPENDS: —
- INPUTS: none
- TOUCHES: root configs; `packages/*` and `apps/*` skeletons; `contracts/foundry.toml`, `contracts/remappings.txt`, `contracts/DEPS.md`, `contracts/lib/**`
- BUDGET: 1.0
- AUTO: yes
- DO:
  - pnpm workspace: `apps/web`, `apps/runner`, `packages/{intent,arkiv,solver-sdk,chain}`, `solver-template`, `scripts`. Package names `@rival/<name>`. `tsconfig.base.json` (strict, ES2022, moduleResolution bundler). ESLint + Prettier. Vitest in each package with a trivial passing placeholder test named `scaffold.test.ts` (**delete nothing the master adds later**).
  - Lint rules: forbid importing from `**/__fixtures__/**`, `**/*.test.*`, `**/*.stories.*` in non-test code; forbid `fetch`/`XMLHttpRequest` outside `packages/solver-sdk`, `packages/arkiv`, `packages/chain`, `apps/runner`, `apps/web/src/data`.
  - Foundry: `contracts/foundry.toml` with `solc = "0.8.26"`, `evm_version = "cancun"`, optimizer 200 runs, `fs_permissions` read for `packages/intent/vectors.json`, RPC alias `sepolia = "${SEPOLIA_RPC_URL}"`. Install libs **pinned**: `forge-std`, `solady`, `openzeppelin-contracts`, `Uniswap/v4-core` at the commit matching npm `@uniswap/v4-core@1.0.2` (`npm view @uniswap/v4-core@1.0.2 gitHead`), `Uniswap/v4-periphery` matching `@uniswap/v4-periphery@1.0.3`, `Uniswap/permit2` (latest release tag), `ensdomains/contracts-v2` (current default-branch commit). Record every pin (repo, sha, date) in `contracts/DEPS.md`. Write `remappings.txt`.
  - Root `package.json` scripts from the **command contract (§6.5)**; scripts owned by MASTER logic are stubs exiting **3** with `NOT_IMPLEMENTED(M-0xx)`.
  - `.gitignore` incl. `secrets/`, `.env.local`, `out/`, `cache/`, `node_modules/`, `.next/`; `.nvmrc` = 22.
  - `.githooks/pre-commit` running `pnpm territory:check` (stub until S-002 → then real); `git config core.hooksPath .githooks` documented in `CONTRIBUTING.md`.
- VERIFY:
  ```bash
  pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && (cd contracts && forge build)
  ```
- DONE-WHEN: All commands exit 0 on an empty-logic tree; `contracts/DEPS.md` lists a sha for each dependency.
- STARTED: 2026-11-06T04:06:21Z
- PROOF: 7543dd3 | pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && forge build --root contracts | exit 0 | contracts/DEPS.md
- BLOCKED-BY:
- NOTES: NatSpec in IRivalOracle.sol no longer uses an at-sign tag, so solc 0.8.26 accepts it. Pins are in contracts/DEPS.md.

### S-002 — Backlog tooling: board, verify, territory-check, freeze-check/write
- STATE: DONE
- OWNER: SLAVE
- PRD: this file §2, §4.2, §6
- DEPENDS: S-001
- INPUTS: this file's grammar (§6.3), territories (§2)
- TOUCHES: `scripts/backlog.ts`, `scripts/territory-check.ts`, `scripts/freeze-check.ts`, `scripts/freeze-write.ts`, `.githooks/**`
- BUDGET: 1.5
- AUTO: yes
- DO:
  - `backlog.ts`: parse `BACKLOG.md` task blocks per grammar; `board` prints counts and per-owner next startable task (all `DEPENDS` DONE; ignore frozen-set tokens until `specs/FREEZE.json` exists); `verify` per §6.3 (sha reachable via `git cat-file -e`, PROOF format regex, optional `--run`).
  - `territory-check.ts`: reads the two glob lists **from §2 of this file** (parse the code fences under §2.1/§2.2) and fails if staged files are outside the current role (env `AGENT_ROLE=MASTER` or `SLAVE`, default error). Implement the §2.3(a) exception: `package.json` / `pnpm-lock.yaml` changes are allowed for either role if (and only if) the `package.json` JSON diff touches only `dependencies`, `devDependencies`, `peerDependencies`.
  - `freeze-write.ts`: computes sha256 of every file in F1–F6 (set definitions from §4.2), writes `specs/FREEZE.json` `{version, files:[{path,sha256,set}], changelog:[{version,time,reason}]}`; `--bump "<reason>"` increments version and appends changelog. **Only MASTER runs it; you only implement it.**
  - `freeze-check.ts`: exits 0 if all hashes match; else prints each changed/missing path with its set and exits 2; `--since <version>` lists sets changed after that version.
  - Replace the stubbed pre-commit with the real territory check.
  - Unit tests for the parser with a fixture copy of §6.3's grammar (fixtures under `__fixtures__`).
- VERIFY:
  ```bash
  pnpm backlog:board && pnpm backlog:verify && AGENT_ROLE=SLAVE pnpm territory:check --self-test && pnpm --filter scripts test
  ```
- DONE-WHEN: Board prints counts for this file; `territory:check --self-test` passes an allowed path, a forbidden path, a deps-only `package.json` change (allowed) and a scripts-key `package.json` change by MASTER (forbidden).
- STARTED: 2026-11-06T04:38:00Z
- PROOF: 63bbb77 | pnpm backlog:board && pnpm backlog:verify && AGENT_ROLE=SLAVE pnpm territory:check --self-test && pnpm --filter scripts test | 6 passed, self-test OK | scripts/backlog.ts
- BLOCKED-BY:
- NOTES: Do not freeze anything yourself.

### S-003 — CI workflows and repo hygiene files
- STATE: BLOCKED
- OWNER: SLAVE
- PRD: §9.6, §11.1, FR-OPS-01
- DEPENDS: S-001, S-002
- INPUTS: command contract
- TOUCHES: `.github/**`, `CODEOWNERS`, `CONTRIBUTING.md`, `LICENSE`, `.gitattributes`
- BUDGET: 1.0
- AUTO: yes
- DO:
  - `ci.yml`: install (frozen lockfile), `lint`, `typecheck`, `test`, `forge:build`, `forge:test` (no fork), `audit:egress`, gitleaks, `backlog:verify`; cache pnpm and forge.
  - `e2e-synthetic.yml`: cron every 30 min running `pnpm e2e:synthetic` (stub exits 3 until M-027; mark job `continue-on-error` until then).
  - PR template listing FR IDs and evidence; `CODEOWNERS` mirroring §2; MIT `LICENSE` (year 2026, holder = `FOUNDER_NAME` placeholder read from `docs/ENV.md` — **do not guess; leave `FILL(FOUNDER_NAME)` and block on H-001**).
- VERIFY:
  ```bash
  pnpm exec actionlint .github/workflows/*.yml
  ```
- DONE-WHEN: `actionlint` clean; workflows reference only existing scripts.
- STARTED: 2026-11-06T05:11:13Z
- PROOF: 016dd8e | pnpm exec actionlint .github/workflows/*.yml | exit 0 | .github/workflows/ci.yml
- BLOCKED-BY: needs-human: H-001
- NOTES: actionlint clean. Workflows, PR template, CODEOWNERS, gitattributes, and the MIT LICENSE are in place. The copyright holder stays FILL(FOUNDER_NAME) until H-001 writes FOUNDER_NAME in docs/ENV.md.

### S-004 — Env files, schema-driven `env:check`, ENV docs
- STATE: TODO
- OWNER: SLAVE
- PRD: §9.3
- DEPENDS: S-001, M-006
- INPUTS: F6 (`specs/env.schema.json`)
- TOUCHES: `.env.example`, `apps/*/.env.example`, `solver-template/.env.example`, `scripts/env-check.ts`, `docs/ENV.md`
- BUDGET: 1.0
- AUTO: yes
- DO:
  - Generate every `.env.example` and `docs/ENV.md` **from** `env.schema.json` (names, description, secret flag, owning human task). No values.
  - `env-check.ts --target <t>`: loads `secrets/.env.local` + process env, prints `OK`/`MISSING: A,B` per target; **never prints values**; exit 1 if missing.
- VERIFY:
  ```bash
  pnpm env:check --target web-build --self-test
  ```
- DONE-WHEN: Self-test proves presence/absence detection and that no value is ever printed.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES:

### S-005 — `TestToken` (Solady ERC20, Permit2-ready) + test
- STATE: DONE
- OWNER: SLAVE
- PRD: FR-VEN-01
- DEPENDS: S-001
- INPUTS: spec below (no logic beyond inheriting Solady)
- TOUCHES: `contracts/src/tokens/TestToken.sol`, `contracts/test/TestToken.t.sol`
- BUDGET: 0.7
- AUTO: yes
- DO:
  - `contract TestToken is ERC20` (Solady): constructor `(string name, string symbol, uint8 decimals, address minter)`; `mint(address,uint256)` only by `minter` (revert `NotMinter()`); `_givePermit2InfiniteAllowance()` returns **true**; EIP-2612 `permit` inherited. Nothing else.
  - Tests: Permit2 allowance is max for anyone; mint auth; decimals; standard transfer semantics (no fee, no hook).
- VERIFY:
  ```bash
  pnpm forge:test --match-contract TestTokenTest
  ```
- DONE-WHEN: Tests pass.
- STARTED: 2026-11-06T05:20:00Z
- PROOF: e1b72ad | pnpm forge:test --match-contract TestTokenTest | 5 passed, 0 failed | contracts/test/TestToken.t.sol
- BLOCKED-BY:
- NOTES: Pinned Solady ERC20 v0.1.26 has `_givePermit2InfiniteAllowance`. This token returns true.

### S-006 — Web shell: Next.js static export, Tailwind, shadcn, layout, route shells
- STATE: TODO
- OWNER: SLAVE
- PRD: FR-OPS-01, §6.6
- DEPENDS: S-001, M-004
- INPUTS: F4 (`viewmodels/routes.ts`)
- TOUCHES: `apps/web/package.json`, `apps/web/next.config.*`, `apps/web/tailwind.config.*`, `apps/web/postcss.config.*`, `apps/web/components.json`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/app/**/page.shell.tsx`
- BUDGET: 1.5
- AUTO: yes
- DO:
  - `output: 'export'`, `images.unoptimized`, no server features; self-hosted fonts (`next/font/local` with files in `apps/web/public/fonts`; **no Google/CDN fonts**); Tailwind; shadcn init.
  - Global layout: header (logo text "Rival", nav from `routes.ts`), disclaimer banner text from `src/content/disclaimers.ts` (S-010), footer.
  - For each route in `routes.ts`, create `page.shell.tsx` exporting a `<RouteShell title=...>` layout wrapper (children slot). **Do not create `page.tsx`** (MASTER does).
- VERIFY:
  ```bash
  pnpm --filter @rival/web build
  ```
- DONE-WHEN: Static export builds with zero third-party hosts in the output (`pnpm audit:egress` once S-019 exists).
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES:

### S-007 — Design-system primitives
- STATE: TODO
- OWNER: SLAVE
- PRD: FR-WEB-*, a11y targets §8.4
- DEPENDS: S-006
- INPUTS: none
- TOUCHES: `apps/web/src/components/ui/**`
- BUDGET: 2.0
- AUTO: yes
- DO:
  - Accessible, keyboard-operable primitives: Button, Card, Badge, Chip, Banner (info/warn/error/success), Table, Tabs, Dialog, Tooltip, Skeleton, CopyButton, ExplorerLink (props: `chain`, `kind: tx|address`, `value`), AddressText (full address on hover/title, EIP-55 display via viem `getAddress`, first-6/last-4 emphasis), TimeAgo (pure), Stat, EmptyState, ErrorState.
  - Every interactive primitive uses ids from `testids.ts`.
- VERIFY:
  ```bash
  pnpm --filter @rival/web test -- ui && pnpm --filter @rival/web exec axe-primitives
  ```
- DONE-WHEN: Component tests pass; axe reports 0 critical/serious on the primitives page (`/__ui` dev-only route excluded from production export).
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES:

### S-008 — Display utilities: `format.ts`, `sanitize.ts`, `testids.ts`
- STATE: DONE
- OWNER: SLAVE
- PRD: FR-WEB-04 (ENS text display safety)
- DEPENDS: S-001
- INPUTS: spec below
- TOUCHES: `apps/web/src/lib/format.ts`, `apps/web/src/lib/sanitize.ts`, `apps/web/src/testids.ts` (+ tests)
- BUDGET: 1.0
- AUTO: yes
- DO:
  - `format.ts` (**display only**): `formatUnitsFixed(bigint, decimals, maxFrac)`, `shortHex(hex, head=6, tail=4)`, `relativeTime(ts, now)`, `bpsToPercentString(int)`, `formatDuration(secs)`. No rounding policy beyond truncation to `maxFrac` toward zero (document it).
  - `sanitize.ts`: `sanitizeDisplayText(input, max)` strips C0/C1 controls, bidi controls U+202A–202E and U+2066–2069, zero-width U+200B–200D/U+FEFF, NFC-normalizes, truncates with ellipsis; returns plain string (never HTML).
  - `testids.ts`: exported const map of `data-testid` strings for every view/primitive; used by components and page objects.
  - Unit tests incl. hostile strings.
- VERIFY:
  ```bash
  pnpm --filter @rival/web test -- lib
  ```
- DONE-WHEN: Tests pass, including RTL-override, zero-width and 10 KB-string cases.
- STARTED: 2026-11-06T05:25:00Z
- PROOF: 26c019c | pnpm --filter @rival/web test -- lib | 12 passed, 0 failed | apps/web/src/lib/format.ts
- BLOCKED-BY:
- NOTES: Formatters truncate toward zero and do not price or settle.

### S-009 — Presentational views (props-only) + stories
- STATE: TODO
- OWNER: SLAVE
- PRD: FR-WEB-02..06, §5.5
- DEPENDS: S-007, S-008, M-004
- INPUTS: F4
- TOUCHES: `apps/web/src/components/views/**`
- BUDGET: 5.0
- AUTO: yes
- DO:
  - One view per F4 view model: `IntentComposerView`, `CurveChartView` (renders given series with a chart lib self-hosted via npm, e.g., `recharts` or `uplot`; **no data fetching, no math beyond layout scaling**), `ReceiptView`, `AuctionStatusView`, `LeaderboardView`, `BookView` (shows the query string and rows), `EventStreamView`, `PresenceChip`, `StatusBanner`, `EvidenceView`, `RunSolverView`, `TxLink`.
  - Props typed **only** by `src/viewmodels/**` (import types; never redefine). Controlled inputs call the provided callbacks; no internal business state besides UI state (open/closed, tab).
  - Stories with fixtures under `__fixtures__` (test/story only).
  - Loading, empty and error states for each view.
- VERIFY:
  ```bash
  pnpm --filter @rival/web typecheck && pnpm --filter @rival/web test -- views
  ```
- DONE-WHEN: Typecheck passes; each view renders from its fixture; no imports from `data/`, `hooks/`, `wallet/` anywhere under `components/**` (grep gate in test).
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES: Missing prop? Do **not** add it — BLOCK with `needs-master-decision` naming the view and prop.

### S-010 — Static content: Evidence, Run-a-solver, disclaimers, troubleshooting
- STATE: TODO
- OWNER: SLAVE
- PRD: §5.8, §5.10, FR-WEB-05/06, §8 (disclosures)
- DEPENDS: S-006
- INPUTS: PRD text
- TOUCHES: `apps/web/src/content/**`
- BUDGET: 1.0
- AUTO: yes
- DO:
  - Typed constants (`disclaimers.ts`, `troubleshooting.ts`, `run-a-solver.ts`, `evidence-copy.ts`) with the text from PRD §5.10, the 4-step "Run a solver" guide (commands exactly: `pnpm solver:init --label <name>`, `pnpm solver:dev`), testnet disclaimer, "intents are public by design" notice, limitations list (§8.1 "Known limit").
  - **Copy only; no claims beyond the PRD.**
- VERIFY:
  ```bash
  pnpm --filter @rival/web typecheck
  ```
- DONE-WHEN: Typechecks; strings match PRD text (diff-checked in a test that reads `PRD.md` sections).
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES:

### S-011 — Playwright config and page objects
- STATE: TODO
- OWNER: SLAVE
- PRD: §11.1
- DEPENDS: S-008, S-009
- INPUTS: `testids.ts`, views
- TOUCHES: `apps/web/playwright.config.ts`, `apps/web/e2e/support/**`, `apps/web/e2e/smoke.spec.ts`
- BUDGET: 1.5
- AUTO: yes
- DO:
  - Config for Chromium/Firefox/WebKit; `baseURL` from env; clean-profile fixture; helpers to block hosts (for Arkiv-blocked drills) via `page.route`; page objects `TradePage`, `AuctionPage`, `LeaderboardPage`, `BookPage`, `EvidencePage` exposing only locator getters and trivial click/fill actions (no flow logic).
  - One `@smoke` spec: app loads, nav works, every route shell renders (no flows).
- VERIFY:
  ```bash
  pnpm e2e --grep "@smoke"
  ```
- DONE-WHEN: Smoke passes in 3 browsers against `web:preview`.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES:

### S-012 — Runner skeleton: server, config, logger, db, middleware, routes, SSE helper, Docker/Fly
- STATE: REWORK
- OWNER: SLAVE
- PRD: FR-RUN-*, §9.2
- DEPENDS: S-001, M-003
- INPUTS: F3
- TOUCHES: `apps/runner/package.json`, `tsconfig.json`, `Dockerfile`, `fly.toml`, `src/server.ts`, `src/config.ts`, `src/logger.ts`, `src/db.ts`, `src/middleware/**`, `src/routes/**`, `src/sse.ts`
- BUDGET: 3.0
- AUTO: yes
- DO:
  - Hono server; `server.ts` flags: `--smoke` (boot, request every route once, exit 0 only if all return the spec'd 501/validation shapes), `--check` (call `runCheck()` from `services/index.ts` and exit with its code; exit 3 if it throws `NotImplemented`), and on normal boot call `startServices()` when `RUNNER_SERVICES=on`. `config.ts` loads env validated by zod **generated from `env.schema.json`** (target `runner`); pino logger with redaction for keys/signatures; `db.ts` better-sqlite3 + migrations (`rate_limits`, `kv`); generic fixed-window rate-limit middleware taking `(key, limit, windowSec)` **as parameters supplied by handlers** (you do not choose limits); CORS limited to `ALLOWED_ORIGIN` env.
  - `routes/*.ts`: one file per endpoint in `runner-api.json`: parse/validate request with zod derived from the spec, call `handlers.<name>(req)`, map typed errors to `{code,message}` + status per spec, return JSON. `/api/intents/stream` uses `sse.ts` broadcaster with `publish(event)`/subscribe.
  - `Dockerfile` (node:22-slim, non-root), `fly.toml` (health check `/api/health`, volume mount for SQLite).
- VERIFY:
  ```bash
  pnpm --filter @rival/runner typecheck && pnpm --filter @rival/runner test && pnpm runner:dev --smoke
  ```
- DONE-WHEN: Server boots; every endpoint returns **501 NOT_IMPLEMENTED** from stub handlers (never 200); request validation rejects malformed bodies with the spec's error shape; no secrets in logs (test).
- STARTED:
- PROOF:
- BLOCKED-BY:
- REWORK-REASON: F3 handlers/index.ts now implements health, faucet, intents, cancel, and stream. types.ts signatures are unchanged. Do not restore the stubs or remove the new apps/runner dependencies. Smoke must accept those implemented responses and the spec's validation errors. startServices and runCheck still throw NotImplemented, so --check still exits 3.
- NOTES: Handlers are MASTER's (`handlers/**`). Do not create them.

### S-013 — ABI generation pipeline and typed deployments loader
- STATE: TODO
- OWNER: SLAVE
- PRD: §6.6
- DEPENDS: S-001, M-001, M-006
- INPUTS: F1 (compiled ABIs), F6
- TOUCHES: `scripts/gen-abis.ts`, `packages/chain/src/generated/**`, `packages/chain/src/deployments.ts`
- BUDGET: 1.5
- AUTO: yes
- DO:
  - `gen:abis`: read `contracts/out/<Interface>.sol/<Interface>.json` for the F1 interfaces + the contracts listed in `specs/deployments.schema.json`; emit `as const` ABIs into `generated/` with a header "GENERATED — do not edit"; deterministic output.
  - `deployments.ts`: types generated from `deployments.schema.json` (json-schema-to-typescript) and `loadDeployments()` that reads `deployments/sepolia.json`, validates with ajv and throws a clear error if missing.
- VERIFY:
  ```bash
  pnpm gen:abis && git diff --exit-code packages/chain/src/generated && pnpm --filter @rival/chain typecheck
  ```
- DONE-WHEN: Re-running produces no diff; typecheck passes.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES: If an ABI is missing, BLOCK on the M-task; never hand-write ABIs.

### S-014 — Arkiv client factory with key rotation
- STATE: DONE
- OWNER: SLAVE
- PRD: §6.7.3, §9.3
- DEPENDS: S-001
- INPUTS: Arkiv docs (clients, access keys); spec below
- TOUCHES: `packages/arkiv/src/client.ts`, `packages/arkiv/src/rotation.ts` (+ tests)
- BUDGET: 1.0
- AUTO: yes
- DO:
  - `createArkivClients({ readKeys: string[], writeKey?: string, transport?: customFetch })`: viem public client for Rabdi (`@arkiv-network/sdk` `createPublicClient`, chain `rabdi({accessKey})`), wallet-client factory for a given account; key rotation on HTTP 401/429 with round-robin and cooldown; exponential backoff (`retry.ts` is S-015); the key goes in the `X-API-KEY` header, not logs.
  - Tests with a local fake HTTP server (test-only).
- VERIFY:
  ```bash
  pnpm --filter @rival/arkiv test -- client rotation
  ```
- DONE-WHEN: Rotation switches keys on 429 and 401 in tests; keys never appear in logged strings.
- STARTED: 2026-11-06T05:28:00Z
- PROOF: d0988d0 | pnpm --filter @rival/arkiv test -- client rotation | 5 passed, 0 failed | packages/arkiv/src/client.ts
- BLOCKED-BY:
- NOTES: Read keys rotate on 401 and 429. The SDK still carries the active key in the Rabdi URL path; the client also sets X-API-KEY and does not log it. Backoff stays local so this package does not depend on solver-sdk.

### S-015 — RPC pool and retry utilities (generic)
- STATE: DONE
- OWNER: SLAVE
- PRD: §8.2 (external failures), FR-WEB data reads
- DEPENDS: S-001
- INPUTS: spec below
- TOUCHES: `packages/solver-sdk/src/rpc-pool.ts`, `packages/solver-sdk/src/retry.ts` (+ tests)
- BUDGET: 1.0
- AUTO: yes
- DO:
  - `withRetry(fn, {retries, baseMs, maxMs, jitter, isRetryable})`.
  - `createRpcPool(urls, {timeoutMs, cooldownMs})`: returns a viem `custom`-compatible transport that rotates providers on timeout/429/5xx, honours `Retry-After`, round-robin otherwise; exposes `stats()`.
- VERIFY:
  ```bash
  pnpm --filter @rival/solver-sdk test -- rpc-pool retry
  ```
- DONE-WHEN: Failover and cooldown covered by tests.
- STARTED: 2026-11-06T05:32:00Z
- PROOF: 6d120f1 | pnpm --filter @rival/solver-sdk test -- rpc-pool retry | 5 passed, 0 failed | packages/solver-sdk/src/rpc-pool.ts
- BLOCKED-BY:
- NOTES:

### S-016 — Solver template and CLI wrappers (`solver:init`, `solver:dev`)
- STATE: TODO
- OWNER: SLAVE
- PRD: FR-SOL-04, FR-WEB-05
- DEPENDS: S-001, M-005, S-004
- INPUTS: F5 (`specs/sdk-api.d.ts`)
- TOUCHES: `solver-template/**` (except logic files you do not create), `scripts/cli/solver-*.ts`
- BUDGET: 1.5
- AUTO: yes
- DO:
  - `commander`-based `solver:init` (flags per `sdk-api.d.ts`: `--label`, `--rpc`, `--key-env`) and `solver:dev`; they **only parse args, load env, call `initSolver` / `runSolver` from `@rival/solver-sdk`, and print results/errors**. Include `README.md` for the template with the 4-step guide and `.env.example`.
  - If the SDK function is not yet implemented, the wrapper prints `NOT_IMPLEMENTED(M-020)` and exits 3.
- VERIFY:
  ```bash
  pnpm solver:init --help && pnpm solver:dev --help
  ```
- DONE-WHEN: Help output lists exactly the flags in the frozen API; wrappers contain no logic beyond I/O.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES:

### S-017 — CLI wrappers: `cli:intent`, `cli:book`, `cli:verify`
- STATE: TODO
- OWNER: SLAVE
- PRD: §5.7 Level C
- DEPENDS: S-001, M-005
- INPUTS: F5
- TOUCHES: `scripts/cli/**`
- BUDGET: 1.0
- AUTO: yes
- DO:
  - Same pattern as S-016 for the three CLIs; pretty-print tables of results returned by SDK functions (columns exactly as in the returned objects).
- VERIFY:
  ```bash
  pnpm cli:intent --help && pnpm cli:book --help && pnpm cli:verify --help
  ```
- DONE-WHEN: Help matches the frozen flag schema.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES:

### S-018 — Documentation skeletons and architecture doc
- STATE: DONE
- OWNER: SLAVE
- PRD: §12, FR-WEB-06
- DEPENDS: S-001
- INPUTS: PRD §6 (diagrams), §12
- TOUCHES: `docs/architecture.md`, `README.skeleton.md`, `FEEDBACK.skeleton.md`, `AI_USAGE.skeleton.md`, `RUNBOOK.skeleton.md`, `arkiv/*.skeleton.md`
- BUDGET: 1.5
- AUTO: yes
- DO:
  - `docs/architecture.md`: copy the Mermaid diagrams from PRD §6.1–6.5 verbatim.
  - Skeletons with all required headings from PRD §12.2–§12.4 (README sections: Judge quick-start, Architecture, **Uniswap integration line map** table with `FILL(` cells, ENS section, Arkiv section, writer addresses, runnable query, third-party table, limitations, AI usage; FEEDBACK sections per §12.3; Arkiv files per §12.4: schema, friction, reach, why-arkiv, how-you-use-arkiv).
  - Every placeholder uses the token `FILL(<what to put>)`.
- VERIFY:
  ```bash
  node -e "const fs=require('fs');for(const f of ['README.skeleton.md','FEEDBACK.skeleton.md','arkiv/schema.skeleton.md','arkiv/friction.skeleton.md','arkiv/reach.skeleton.md','arkiv/why-arkiv.skeleton.md','arkiv/how-you-use-arkiv.skeleton.md']){if(!fs.existsSync(f))throw new Error('missing '+f)};console.log('OK')"
  ```
- DONE-WHEN: Files exist; headings match the PRD; no prose claims, only structure and `FILL(`.
- STARTED: 2026-11-06T05:34:00Z
- PROOF: 76de832 | node -e "const fs=require('fs');for(const f of ['README.skeleton.md','FEEDBACK.skeleton.md','arkiv/schema.skeleton.md','arkiv/friction.skeleton.md','arkiv/reach.skeleton.md','arkiv/why-arkiv.skeleton.md','arkiv/how-you-use-arkiv.skeleton.md']){if(!fs.existsSync(f))throw new Error('missing '+f)};console.log('OK')" | OK | docs/architecture.md
- BLOCKED-BY:
- NOTES: Diagrams in docs/architecture.md are copied from PRD §6.1–§6.5. Skeletons are headings and FILL( tokens.

### S-019 — Scripts: verify-deployments, audit-egress, preflight skeleton, licenses table
- STATE: TODO
- OWNER: SLAVE
- PRD: §9.6, FR-OPS-01, §6.9
- DEPENDS: S-001, M-006
- INPUTS: F6; PRD §9.6 table
- TOUCHES: `scripts/verify-deployments.ts`, `scripts/audit-egress.ts`, `scripts/preflight.ts`, `scripts/preflight.config.ts`, `scripts/licenses-table.ts`, `THIRD_PARTY.md`
- BUDGET: 2.5
- AUTO: yes
- DO:
  - `verify-deployments.ts [--only venue|ens|all]`: load `deployments/sepolia.json` (validate with F6), `eth_getCode` each address on Sepolia via RPC pool, print table, exit 1 on any empty; optionally compare with README-embedded addresses.
  - `audit-egress.ts`: scan `apps/web/out/**` for `https?://` hosts; compare with allowlist file `scripts/egress-allowlist.json` (hosts provided by MASTER later; initial allowlist = sepolia RPC hosts from env + Rabdi + runner + explorer links); fail on others.
  - `preflight.config.ts`: array of the 19 checks from PRD §9.6 as `{id, title, owner, command, autoRunnable}`; checks whose command is not yet implemented use `pnpm exec node -e "process.exit(3)"` placeholders **explicitly labelled `NOT_IMPLEMENTED(owner-task)`**. `preflight.ts` runs them, prints PASS/FAIL/NOT_IMPLEMENTED, exits non-zero unless all PASS; supports `--only`.
  - `licenses-table.ts`: emit `THIRD_PARTY.md` from lockfiles + `contracts/DEPS.md`, flagging BUSL-1.1 (v4-core).
- VERIFY:
  ```bash
  pnpm verify:deployments --self-test && pnpm audit:egress --self-test && pnpm preflight --list && pnpm licenses:table
  ```
- DONE-WHEN: Self-tests pass; `preflight --list` shows 19 checks; `THIRD_PARTY.md` generated.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES:

### S-020 — Hosting config: Vercel headers/CSP, runner Fly config
- STATE: TODO
- OWNER: SLAVE
- PRD: FR-OPS-01, §9.2
- DEPENDS: S-006, S-012
- INPUTS: PRD FR-OPS-01 CSP text
- TOUCHES: `apps/web/vercel.json`, `apps/runner/fly.toml`
- BUDGET: 0.7
- AUTO: yes
- DO:
  - `vercel.json` headers for all routes: CSP `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' <hosts from env at build>; frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`; `cleanUrls`; no cookies.
  - `connect-src` hosts are listed in a generated file from env (`NEXT_PUBLIC_SEPOLIA_RPCS`, Rabdi RPC, runner URL) — **do not hard-code provider hosts you were not given**; if the env schema lacks them, BLOCK on M-006.
- VERIFY:
  ```bash
  node scripts/check-headers.mjs apps/web/vercel.json
  ```
- DONE-WHEN: Script confirms required headers present and no wildcard sources.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES: Add `scripts/check-headers.mjs` (SLAVE territory under `scripts/` utilities) as part of this task.

### S-021 — Accessibility and performance gates (axe + Lighthouse CI config)
- STATE: TODO
- OWNER: SLAVE
- PRD: AT-16, FR-OPS-01
- DEPENDS: S-011
- INPUTS: page objects
- TOUCHES: `apps/web/e2e/a11y.spec.ts`, `lighthouserc.json`, `.github/workflows/ci.yml` (append job)
- BUDGET: 1.0
- AUTO: yes
- DO:
  - Playwright + `@axe-core/playwright` spec visiting every route shell, failing on serious/critical; Lighthouse CI config with a11y ≥ 95 assertion.
- VERIFY:
  ```bash
  pnpm e2e --grep "@a11y"
  ```
- DONE-WHEN: Passes on shells; reported as a CI job.
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES: Re-run after MASTER wires pages (M-024) — then expect `REWORK` only if the views, not the data, are at fault.

---

## 9. HUMAN backlog (the FOUNDER; agents prompt for these)

> Agents print the §5 block for each H-task they are blocked on. The human edits the `STATE` line and fills `PROOF` (what was done, date).

### H-001 — Create the public GitHub repo, set identity, install hooks
- STATE: TODO
- OWNER: FOUNDER
- PRD: §2.2 (public repo, MIT)
- DEPENDS: —
- BUDGET: 0.3
- DO:
  - Create a **public** GitHub repo (name suggestion: `rival`). Push the current folder (`git init` if needed). Set your legal name as the MIT license holder (S-003 will block on `FILL(FOUNDER_NAME)` until you put `FOUNDER_NAME=<name>` in `docs/ENV.md`'s "project metadata" section or tell the agent).
  - Run once locally: `git config core.hooksPath .githooks`. Agents start with `AGENT_ROLE=MASTER` or `AGENT_ROLE=SLAVE` exported in their shells.
- RETURN: repo URL in `secrets/.env.local` as `GITHUB_REPO_URL`
- CHECK: `pnpm env:check --target ci`
- PROOF:
- BLOCKED-BY:
- NOTES:

### H-002 — Generate and fund wallets (Sepolia ETH ≥ 3, plus tGLM)
- STATE: WORKING
- OWNER: FOUNDER
- PRD: §9.5, K5
- DEPENDS: —
- BUDGET: 2.0 (can run in the background)
- DO:
  - Generate **separate** keys (do not reuse personal wallets): `OPERATOR` (deploys/ENS), `MM` (market maker), `HOUSE`, `SOLVER_ATLAS`, `SOLVER_MERIDIAN`, `SOLVER_FENIX`, `SOLVER_VAULT`, `MAKERBOT_1..3`, `FAUCET_MINTER`, `RELAYER`, `UNLISTED_BOT`. Tool: `cast wallet new` ×N (Foundry) — keep the output **only** in `secrets/.env.local`.
  - Obtain **≥ 3 Sepolia ETH** in total, prioritizing `OPERATOR` (≥ 0.8), `MM` (≥ 1.0), `HOUSE` (≥ 0.3), solvers (0.1 each), `RELAYER` (0.2). Use public Sepolia faucets and/or a proof-of-work faucet (e.g. a browser PoW faucet mining in the background) — this is the long pole, **start it now**.
  - Get Rabdi tGLM for each solver/publisher wallet from https://hub.arkiv.network/faucet.
- RETURN: `secrets/.env.local` with the variable names listed in `specs/env.schema.json` (runner/operator targets)
- CHECK: `pnpm env:check --target operator` and `--target runner` → OK
- PROOF: 2026-11-06 | cast balance --rpc-url rpc1 | operator 0xFeAf5C921996FC53f4DEf35e181E766e6D74690A 1.179 ETH after sends (started 3.330) | secrets/.env.local
- PROOF: 2026-11-06 | cast balance | MM 0x16A13b04775D733aEAAAb88d77A69d1b9ffA0062 1.00 | tx 0xbbc9f126a6d21f1df423d91ced6cffdf44a72dcf4f3df46c5d0f471c8d44739c
- PROOF: 2026-11-06 | cast balance | HOUSE 0x79bC47e448b1B52F3DE651a0d102FD73FaDD7B7C 0.30 | tx 0xd2041e81ec7dee969f9eb9a5f0ce7328f5a861983855c290ea64129108524a23
- PROOF: 2026-11-06 | cast balance | ATLAS 0xD2aA21AF4faa840Dea890DB2C6649AACF2C80Ff3 0.100 | tx 0x7f1ed21d6bfd402e46e29974f658a75a060653bfa51ff80b729047ba32d3e6ea
- PROOF: 2026-11-06 | cast balance | MERIDIAN 0x97e6c2b90492155bFA552FE348A6192f4fB1F163 0.100 | tx 0x94e5fbaa04b51c1966d9429a17a1c12ca2eb21f8beedf23cbddcd936fce2100c
- PROOF: 2026-11-06 | cast balance | FENIX 0x8AF6577a9ea6B9372Df5fD8762D8d9789E04275F 0.100 | tx 0x1e955f00e9550fbae22366acebe11a8fb12ea3eeb9d3c845576bb9a4ff47f64a
- PROOF: 2026-11-06 | cast balance | VAULT 0x7521EE686392EF1f27B2DDc757653875a7C3F831 0.116 | tx 0x85830d928bf758d657620e1c526f27b3837c1082a1ec39f77edeafce1ccede56
- PROOF: 2026-11-06 | cast balance | RELAYER 0x8cEa9b4F8C42464A3661b5ea08FD5EE566557c45 0.20 | tx 0x34454947395d5c0f2bebb84a9b2c4ef168ea91cf43884315e90edb0740cd9902
- PROOF: 2026-11-06 | cast balance | MAKERBOT_1 0xFc21eC9b802932918640F5Ce8f372E1A5b2EE81a 0.05 | tx 0x1c808e6f0f829d923306d48bb18ee0f3cb7687b853f1acb64ab7d5aec1068105
- PROOF: 2026-11-06 | cast balance | MAKERBOT_2 0x7A23914e049954145c285F951D83b9a63C9D4Eda 0.05 | tx 0xc0abdd5e7513b1e0a8d077f26e1589037360ad3bd76d00c5899f98a3cf4feecb
- PROOF: 2026-11-06 | cast balance | MAKERBOT_3 0x13e17fC2Eb8CD89BD433AB6b131047b1A1BF1531 0.05 | tx 0x213d9a379863b93c5833107087a99da4922b81ab594be436a8f956c5c1859e06
- PROOF: 2026-11-06 | cast balance | FAUCET_MINTER 0x29EEBc9d07d725f72D3de5D47eA048187fc800A9 0.05 | tx 0x6741c68c2bcfafad8ddae29a4bd04411d97f9e566aa90f46806659196af85dc3
- PROOF: 2026-11-06 | cast balance | UNLISTED_BOT 0xA3d458197eD27a1Af545Cd37b495a0ff56A8927C 0.05 | tx 0x1b97472e8c99a468e8d023795152f0f0b2bed0c70368863d820c86beca9a6be4
- BLOCKED-BY:
- NOTES: Sepolia ETH sent. Keys in secrets/.env.local only. tGLM faucet for solver/publisher wallets is still open, so this stays WORKING.

### H-003 — Fund and confirm the OPERATOR wallet
- STATE: TODO
- OWNER: FOUNDER
- PRD: §9.4
- DEPENDS: H-002
- BUDGET: 0.1
- DO:
  - Confirm `cast balance $OPERATOR_ADDRESS --rpc-url $SEPOLIA_RPC_URL` ≥ 0.8 ETH. Put `SEPOLIA_RPC_URL` (a reliable provider URL, e.g. a free-tier key from a major provider) and `SEPOLIA_RPC_URL_2`, `SEPOLIA_RPC_URL_3` (different providers) in `secrets/.env.local`.
- RETURN: three RPC URLs in `secrets/.env.local`
- CHECK: `pnpm env:check --target operator`
- PROOF: 2026-11-06 | cast balance | operator 0xFeAf5C921996FC53f4DEf35e181E766e6D74690A 1.179 ETH | secrets/.env.local
- BLOCKED-BY:
- NOTES: Balance is above 0.8 ETH. SEPOLIA_RPC_URL, SEPOLIA_RPC_URL_2, and SEPOLIA_RPC_URL_3 are in secrets/.env.local. Stays TODO until pnpm env:check exists (S-004).

### H-004 — Provision the runner host (Fly.io or VPS) and set secrets
- STATE: TODO
- OWNER: FOUNDER
- PRD: §9.2
- DEPENDS: H-002, S-012
- BUDGET: 0.7
- DO:
  - Create a Fly.io account/app (or a small VPS). `fly launch --no-deploy` using `apps/runner/fly.toml`; create a 1 GB volume; set secrets from `secrets/.env.local` (`fly secrets import < secrets/runner.env` — agent S-004 documents the exact export script).
- RETURN: `RUNNER_URL` (https) in `secrets/.env.local`
- CHECK: `pnpm env:check --target runner`
- PROOF:
- BLOCKED-BY:
- NOTES:

### H-005 — Arkiv access keys and wallets
- STATE: TODO
- OWNER: FOUNDER
- PRD: §6.7.3, §9.3, S4
- DEPENDS: H-002
- BUDGET: 0.4
- DO:
  - At https://hub.arkiv.network/access-keys: connect a wallet, choose network **Rabdi**, create **1 write key** and **2–3 read keys** (one key per wallet per network, so use different wallets for different keys). Leave Origins/IP allowlists **empty** for now.
- RETURN: `ARKIV_ACCESS_KEY_WRITE`, `ARKIV_ACCESS_KEYS_READ` (comma-separated) in `secrets/.env.local`
- CHECK: `pnpm env:check --target runner`
- PROOF:
- BLOCKED-BY:
- NOTES:

### H-006 — ENS parent name on Sepolia (decision + registration)
- STATE: TODO
- OWNER: FOUNDER
- PRD: FR-ENS-01, S3
- DEPENDS: H-002
- BUDGET: 0.5
- DO:
  - Open the Sepolia ENS app (linked from the ENS docs). Check whether `rival.eth` is available; if yes, register it **from the OPERATOR address** (needs Sepolia ETH). If not, pick another available label and set `ENS_PARENT_LABEL=<label>`.
  - If the MASTER's S3 spike finds contract-driven registration is possible, it may tell you to skip manual registration; follow its printed instruction.
- RETURN: `ENS_PARENT_LABEL` in `secrets/.env.local`
- CHECK: `pnpm env:check --target operator`
- PROOF:
- BLOCKED-BY:
- NOTES: Write the final decision in the PROOF line.

### H-007 — Etherscan API key
- STATE: TODO
- OWNER: FOUNDER
- PRD: §9.4 step 9
- DEPENDS: —
- BUDGET: 0.1
- DO: Create a free Etherscan API key (supports Sepolia).
- RETURN: `ETHERSCAN_API_KEY` in `secrets/.env.local`
- CHECK: `pnpm env:check --target operator`
- PROOF:
- BLOCKED-BY:
- NOTES:

### H-008 — Vercel project (production, protection OFF) and env vars
- STATE: TODO
- OWNER: FOUNDER
- PRD: §5.1, §9.2
- DEPENDS: H-001, S-006
- BUDGET: 0.4
- DO:
  - Create a Vercel project from the repo, root `apps/web`, framework Next.js (static export). In Settings → Deployment Protection: **disable for Production**. Disable Analytics/Speed Insights. Add the `NEXT_PUBLIC_*` variables printed by `pnpm env:check --target web-build --print-names`.
- RETURN: `WEB_URL` in `secrets/.env.local`
- CHECK: `curl -sI $WEB_URL | head -1` returns 200 (after first deploy) and no auth wall
- PROOF:
- BLOCKED-BY:
- NOTES:

### H-009 — Uptime monitor and alert channel
- STATE: TODO
- OWNER: FOUNDER
- PRD: FR-RUN-03, §9
- DEPENDS: H-004, H-008
- BUDGET: 0.2
- DO: Create an external monitor (e.g. a free uptime service) for `WEB_URL` and `RUNNER_URL/api/health`, 5-minute interval, alerting your phone.
- RETURN: monitor URLs in PROOF
- CHECK: monitor shows "up"
- PROOF:
- BLOCKED-BY:
- NOTES:

### H-010 — Review gates (C0, C1, C2, C4)
- STATE: TODO
- OWNER: FOUNDER
- PRD: §10.4, §13.2
- DEPENDS: per gate
- BUDGET: 0.3 each
- DO:
  - **C0 (after M-007):** skim `specs/FREEZE.json` + F1/F4 files; reply "C0 approved" or list changes (MASTER then bumps the freeze).
  - **C1 (H+5):** read `docs/spikes/S1.md`, `S2.md`, `S3.md`, `S4.md`; decide K1/K2/K3/K6 (continue / fallback / drop pick) and write the decision into the PROOF line.
  - **C2 (H+14):** watch a live fill on production; approve or list defects.
  - **C4 (H+27):** approve the release candidate.
- RETURN: decisions in PROOF
- CHECK: —
- PROOF: 2026-11-06 | founder: C0 approved (H-010). C1, C2, and C4 remain open.
- BLOCKED-BY:
- NOTES: C0 is approved. MASTER continues past C0. C1 still needs S1–S4.

### H-011 — Judge dry-run and solver-onboarding dry-run by a non-author
- STATE: TODO
- OWNER: FOUNDER
- PRD: AT-10, AT-11
- DEPENDS: M-027, S-016
- BUDGET: 1.0
- DO: Ask a friend/colleague who has not seen the project to (a) open the production URL and get a receipt in ≤ 5 minutes, (b) run `pnpm solver:init` + `pnpm solver:dev` from a clean clone and get listed in ≤ 10 minutes. Time them; write notes into `docs/judge-dryrun.md`.
- RETURN: `docs/judge-dryrun.md`
- CHECK: file exists with two timings
- PROOF:
- BLOCKED-BY:
- NOTES:

### H-012 — Uniswap feedback form + FEEDBACK.md
- STATE: TODO
- OWNER: FOUNDER
- PRD: §2.2 Uniswap qualification, §12.3
- DEPENDS: M-029
- BUDGET: 0.4
- DO:
  - Read `FEEDBACK.md` (edit for honesty/voice). Submit https://developers.uniswap.org/hackathon-feedback with the **link to `FEEDBACK.md` on GitHub**. Save a screenshot of the confirmation into `docs/uniswap-feedback-receipt.png`.
- RETURN: screenshot file
- CHECK: file exists
- PROOF:
- BLOCKED-BY:
- NOTES: Missing this risks audit before winners are finalized.

### H-013 — Record the video, submit on ETHGlobal, attend booths
- STATE: TODO
- OWNER: FOUNDER
- PRD: §12.1, §12.5
- DEPENDS: M-030, H-012
- BUDGET: 2.0
- DO:
  - Record per PRD §12.5 (real-time, your own voice, ≥ 720p, ≤ 4 bullet slides, ≤ 20 s backstory). Upload; link in README (MASTER) and in the ETHGlobal form. Select partners: **Uniswap Foundation, ENS, Arkiv** (tracks per PRD §12.1). Submit before Sat 07:30 IST. Plan to be at the three booths Saturday morning.
- RETURN: submission confirmation in PROOF
- CHECK: —
- PROOF:
- BLOCKED-BY:
- NOTES:

### H-014 — Decide optional extras (Swarm bonus, maker-agent delegation)
- STATE: TODO
- OWNER: FOUNDER
- PRD: F10, F12
- DEPENDS: M-026
- BUDGET: 0.1
- DO: At C3, decide whether any P1/P2 item is worth the risk. Default **no**. Write the decision in PROOF.
- RETURN: decision
- CHECK: —
- PROOF:
- BLOCKED-BY:
- NOTES:

---

## 10. Dependency map (so neither agent waits blindly)

```
SLAVE starts immediately:  S-001 → S-002 → S-003 ; S-001 → S-005 ; S-001 → S-014 ; S-001 → S-015 ; S-001 → S-018 ; S-001 → S-008
MASTER starts immediately: M-001 M-002 M-003 M-004 M-005 M-006 (write files; compile checks wait for S-001)  → M-007 (needs S-002)
Unblocked by C0 freeze:    S-004 S-006 S-009 S-012 S-013 S-016 S-017 S-019 S-020
Unblocked by SLAVE output: M-010..M-014 need S-001 ; M-021 needs S-012 ; M-019 needs S-014 ; M-020 needs S-015 ; M-023 needs S-013 ; M-024 needs S-006 S-009 S-010 ; M-027 needs S-011
Human long pole:           H-002 (Sepolia ETH) — start at minute 0; H-006/H-005/H-004/H-008 in parallel
Gates:                     C0 (H-010) → C1 (H-010) → C2 → C3 → C4 → H-012 → H-013
```

First 30 minutes, concretely:

- **MASTER:** M-001…M-006 (write spec files) → wait for S-001/S-002 → M-007.
- **SLAVE:** S-001 → S-002 → S-005 → S-008 → S-014 → S-015 → S-018 → S-003 → (then everything unblocked by C0).
- **FOUNDER:** H-001, H-002 (start the faucet mining now), H-007, then H-005/H-006.

---

## 11. Quick reference

| Need | Command |
| --- | --- |
| See state of everything | `pnpm backlog:board` |
| Prove a task | `pnpm backlog:verify --task <ID> --run` |
| Am I in my territory? | `AGENT_ROLE=<MASTER|SLAVE> pnpm territory:check` |
| Did the frozen interfaces change? | `pnpm freeze:check` |
| Freeze/bump (MASTER only) | `pnpm freeze:write --bump "<reason>"` |
| Which secrets are missing? (no values) | `pnpm env:check --target <t>` |
| Everything green before submit | `pnpm preflight` |

**Final rule for both agents:** a task is not done because the code looks right. It is done when `VERIFY` passes on `main`, the `PROOF` line is written, and the `STATE` line says `DONE`.
