# Slither — contracts/src

## Run

Slither **0.11.6** (crytic-compile against Foundry). The machine `python3` is 3.14, so the analyzer was installed on Python 3.12:

```bash
python3.12 -m venv /tmp/slither-m025
/tmp/slither-m025/bin/pip install slither-analyzer==0.11.6
/tmp/slither-m025/bin/slither contracts \
  --config-file contracts/slither.config.json \
  --disable-color
```

Working directory is the repo root. `contracts/slither.config.json` forces the Foundry framework, sets `exclude_dependencies`, and sets `include_paths` to `contracts/src/`. A result is kept when any element is under `contracts/src`. Findings that exist only in `contracts/lib` are omitted.

`filter_paths` is also set to `contracts/lib/`. Slither applies `include_paths` and ignores `filter_paths` when both are set (`slither/core/slither_core.py`). `include_paths` is the filter that was in effect. Using only `filter_paths` would drop a result that mentions a vendored file at all, including a finding in `contracts/src` that also points at solady or v4.

crytic-compile ran `forge clean` and then `forge build --build-info --deny never --skip ./test/** ./script/** --force` in `contracts/`. The build finished; `contracts/out` is populated. No contract source was changed after this run, so nothing below is marked fixed.

Slither printed `Missing function Variable not found: CancelledErr()` while loading `RivalSettlement`. That comes from the import alias `Cancelled as CancelledErr`. It is not a detector result. Analysis still completed: 53 contracts, 102 detectors, 35 results.

## Counts

| Impact | Count |
| --- | ---: |
| High | 2 |
| Medium | 9 |
| Low | 18 |
| Informational | 6 |

Low and informational results are not triaged here. They include timestamp comparisons on the curve and the TWAP, missing zero-address checks on immutable constructor args, local shadowing of `intentHash`, assembly in `_hashIntent`, and the multi-pragma notice that lists vendored files because that one result also names `contracts/src`.

## High

### weak-prng — false positive

`RivalOracleHook._floorDiv` (`contracts/src/hook/RivalOracleHook.sol`, lines 221–228). Slither flags `n % d` as a weak PRNG. The `%` is the remainder test for division toward negative infinity. `_floorDiv` has no randomness and no secret. Confidence: Medium.

### uninitialized-state — false positive

`RivalSettlement._status` (`contracts/src/RivalSettlement.sol`, line 109). This is a `mapping(bytes32 => IntentStatus)`. Solidity mappings have no constructor initializer; an unset key is zero. `IntentStatus.NONE` is 0 (`contracts/src/Types.sol`). `_precheck` treats `NONE` as open, `FILLED` as already filled, and any other value as cancelled. Confidence: High.

## Medium

### incorrect-equality — false positive (2)

`recordObservation` compares `nowTs == latest.ts` (line 133) and `_tickEnd` compares `latest.ts == nowTs` (line 178), both in `contracts/src/hook/RivalOracleHook.sol`. Both sides are `uint32` unix seconds. Equality is the one-observation-per-timestamp rule: a second swap in the same second does not append a ring slot, and a consult in that second keeps the pre-swap tick. This is not a balance or `address` check. Confidence: High.

### reentrancy-no-eth — false positive (2)

1. `SolverRegistry.exit` (`contracts/src/SolverRegistry.sol`, lines 83–93) calls `names.unregister` and then deletes `_labels`.
2. `RivalNames.unregister` (`contracts/src/ens/RivalNames.sol`, lines 78–83) calls `ens.unregister` and then deletes `_tokenIds`.

The cross-function calls Slither names do not run:

- `register` and `exit` share `lock()`. The lock is set before the external call and cleared only after the deposit refund. A second `register` or `exit` reverts `Unauthorized`.
- `RivalNames` mutators use `onlyRegistry`. During `ens.unregister`, a callback’s sender is the ENS registry, not `SolverRegistry`, so `issue`, `renew`, and `unregister` revert.
- Pinned `PermissionedRegistry.unregister` burns through `ERC1155Singleton._burn`. The burn’s `to` is `address(0)`, and `_updateWithAcceptanceCheck` skips the ERC-1155 receiver in that case, so the name owner is not called.

The deletes stay after the external call so a reverting `unregister` leaves the listing and the deposit in place (`test_unregisterRevertKeepsDeposit`). Confidence: Medium.

### uninitialized-local — false positive

`SolverRegistry.syncRecords` declares `int256 avg` (`contracts/src/SolverRegistry.sol`, line 137). In Solidity 0.8 that local is 0. The next line assigns `sumImprovementBps / fills` only when `fills != 0`. Zero is the average for a solver with no counted fills. Confidence: Medium.

### unused-return — false positive (4)

| Site | What is ignored | Why it is not a missed check |
| --- | --- | --- |
| `SolverRegistry.register` line 79 | `names.issue` returns `uint256` | `RivalNames.issue` stores the token id and reverts if ENS register reverts. The registry reads the id later with `tokenIdOf`. |
| `RivalOracleHook.recordObservation` line 135 | three of four `getSlot0` fields | Only `tick` is written into the observation. |
| `RivalOracleHook._tickEnd` line 179 | three of four `getSlot0` fields | Only `tick` is the live end-of-window price. |
| `UniswapSolver.rivalFillCallback` lines 68–77 | `poolManager.unlock` returns `bytes` | `unlockCallback` returns `""`. A failed swap reverts inside `unlock`. After it returns, the solver checks `tokenIn` is gone and `tokenOut` covers `requiredOut`. |

Confidence: Medium.
