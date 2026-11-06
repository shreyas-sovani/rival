# ENS names and the solver registry

`SolverRegistry` takes a listing deposit and issues one ENSv2 label per solver. `RivalNames` is the only contract that calls the solvers registry. Gating reads `ownerOf` and fails closed. Protocol stats (`com.rival.*`) are stored on `RivalNames`, not in ENS text records. That is the S3 fallback. See [spikes/S3.md](spikes/S3.md).

## Deploy

The two contracts point at each other with immutables.

1. Predict the `SolverRegistry` address (the deployer's next CREATE address after `RivalNames`).
2. Deploy `RivalNames(predictedRegistry, ensRegistry, resolver)`.
3. Deploy `SolverRegistry(depositToken, depositAmount, names, house)` at that predicted address.
4. On the solvers registry, grant `RivalNames` root `ROLE_REGISTRAR` (`1 << 0`), `ROLE_RENEW` (`1 << 16`), and `ROLE_UNREGISTER` (`1 << 12`). No other root roles.

`resolver` may be `address(0)` until a `PermissionedResolver` can be compiled. `issue` still passes it through to `register`. Protocol stats do not use it.

## Deposit

`depositAmount` is the immutable the deployer passes. Tests use other amounts. Production is **100 tUSDC = `100 * 10^6` = `100_000_000`**, because tUSDC has 6 decimals. The contract does not hardcode that number.

`register` pulls exactly `depositAmount` with Solady `safeTransferFrom`. A `false` return or a short balance reverts, and the name is not issued. `exit` sends the same amount back. The deposit is anti-spam. It is not a slash.

## Registration

`register(label)`:

1. The caller has no stored label. A second name reverts `LabelUnavailable`.
2. The label is 3 to 24 bytes from `[a-z0-9-]`. Empty, uppercase, other characters, and the wrong length revert `LabelUnavailable`.
3. `rival`, `admin`, and `official` are reserved. `house` is reserved unless `msg.sender` is the house address stored at construction.
4. The label is not already stored for another solver (`LabelUnavailable`).
5. The deposit moves, then `RivalNames.issue(label, solver, block.timestamp + 30 days)`.
6. `issue` calls the pinned ENS register:

```solidity
register(label, owner, subregistry, resolver, roleBitmap, expiry) returns (uint256 tokenId)
```

`subregistry` is `address(0)`. `roleBitmap` is `0`. The token id from that call is what `tokenIdOf` returns. If `issue` reverts, the whole `register` reverts and the deposit is not kept.

One solver address, one label. `exit` clears the label so the same address can register again. The next `issue` is a new ENS token.

## Role bitmap

`SOLVER_ROLE_BITMAP` is `0`.

The bitmap on `PermissionedRegistry.register` grants **registry** roles on that name. It does not grant resolver text roles. `ROLE_CAN_TRANSFER_ADMIN` is `(1 << 28) << 128`. It is absent, so `safeTransferFrom` reverts `TransferDisallowed`. The bitmap also omits registrar, renew, unregister, set-resolver, set-subregistry, and every admin role. `RivalNames` never grants or revokes roles after `issue`. A role change regenerates the ERC1155 id (`TokenRegenerated`). The id stored at issue then fails `ownerOf`, and `isListed` becomes false. That is the stale-id rule from FR-ENS-05. Executed in `test_roleChangeStalesStoredTokenId`.

Solver-editable keys (`description`, `url`, `avatar`, `agent-context`, `agent-endpoint[...]`, `agent-registration[...]`) are resolver text roles (`authorizeTextRoles` / `ROLE_SET_TEXT` on one key). This checkout cannot compile `PermissionedResolver` (empty `ens-contracts` submodule), so those roles are not granted. The solver cannot write `com.rival.*` because nobody writes those keys to ENS.

## What `isListed` trusts

`isListed(solver)`:

1. Read `names.tokenIdOf(solver)`. Zero means false.
2. `try` `ownerOf(tokenId)` on `RivalNames`, which calls the ENS registry.
3. True only when the returned owner equals `solver`.
4. False when `ownerOf` returns `address(0)`, returns any other address, or reverts.

The registry's own label mapping is not the gate. An open intent never needs this read. A failed read fails closed for a listed or named gate.

The pinned registry treats `block.timestamp >= expiry` as expired and `ownerOf` returns `address(0)` in that same block. `isListed` is then false while `tokenIdOf` still returns the old id.

## `ownsAny` hash

`ownsAny(solver, labelHashes)` is true when `isListed(solver)` is true and `keccak256(bytes(label))` appears in `labelHashes`.

The preimage is the raw label string, for example the bytes of `atlas`. That is `keccak256(bytes(label))`, the same bytes as `keccak256(abi.encodePacked(label))`. It is not `keccak256(abi.encode(label))`, not a DNS wire name, and not a hash of hashes.

PRD §7 and `packages/intent/src/build.ts` define `Intent.allowlistHash` as `keccak256(abi.encodePacked(labelhashes))` for a named gate. Each element of that list is a label hash. This contract treats each element as `keccak256(bytes(label))`. `ownsAny` does not recompute `allowlistHash`. Settlement checks that commitment before it calls `ownsAny`.

## Records

`onFill` is only callable by the settlement address bound with `setSettlement`. The first caller sets it. A second call reverts `Unauthorized`, even with the same address.

Stats, in storage:

- `fills` increments by one.
- `makers` increments the first time that maker is seen for that solver. The seen-set is not cleared on `exit`.
- `sumImprovementBps` adds the signed `int32`.
- `lastFill` is `block.timestamp`.

Then `renew(solver, block.timestamp + 30 days)` is `try/catch`. An ENS failure does not revert `onFill`. `onFill` does not call `syncRecords`. Anyone may call `syncRecords(solver)` later. It reverts `LabelUnavailable` when the solver has no stored label. The average is `sumImprovementBps / fills`, truncating toward zero, or `0` when `fills` is `0`.

`RivalNames.syncRecords` writes those four numbers into `protocolRecord(solver)`. It does not call `setText`. A direct call from any address other than the registry reverts `Unauthorized`.

`RivalNames.renew` passes `max(currentExpiry, expiry)` into ENS `renew(anyId, newExpiry)`, because the pinned function reverts `CannotReduceExpiry` when the new timestamp is earlier. It renews by timestamp, not by duration.

## Exit and lapse

`exit` requires a stored label (`Unauthorized` otherwise). It calls `unregister`. If that reverts, `exit` reverts and the deposit stays. On success it clears the label and refunds exactly `depositAmount`.

On the pinned registry, `unregister` reverts `LabelExpired` once `block.timestamp >= expiry`. A lapsed solver therefore cannot `exit` until the name is live again. `renew` from `RivalNames` can revive an expired name, because the root `ROLE_RENEW` grant makes `PermissionedRegistry._canRevive` true. `onFill` does that renew inside `try/catch`. After a successful revive, `ownerOf` is the solver again and `exit` can unregister and refund.

Stats are not cleared on `exit`. A later registration keeps the counters and the seen-maker set.

## Fallback

Primary per-record ENS text was not shipped. `com.rival.fills`, `com.rival.makers`, `com.rival.avgImprovementBps`, and `com.rival.lastFill` are the `protocolRecord` view on `RivalNames`. ENS is the identity: register, `ownerOf`, renew, unregister. Gating still uses `ownerOf` and fails closed. This is FR-ENS-06 (b) implemented as protocol storage, not as a child name `stats.<label>.solvers.<parent>.eth`, because that child still needs the resolver and a parent `.eth`.

## Sepolia deployment

Deployed with `contracts/script/DeployNames.s.sol`. `MockLabelStore`, `PermissionedRegistry`, and `EnsPairFactory` are CREATE2 deployments. The factory then CREATE-deploys `RivalNames` and `SolverRegistry`, so each constructor is given the other's predicted address. The label store is `MockLabelStore` from `contracts/test/ens/EnsHarness.sol`. No `.eth` parent was registered. H-006 stays waived.

| Contract | Address |
| --- | --- |
| MockLabelStore | `0x3c328efaFa5a2493121e824695C791f78Ee5D360` |
| PermissionedRegistry (`ens.solversRegistry`) | `0xCEec9D7ADcad00e4D842283d9526E75C9440b36f` |
| RivalNames (`names`) | `0xC20a61e830bB91A69C1B6BCcd607299152aDE797` |
| SolverRegistry (`registry`) | `0x6AD5C78fA2278d397Bb7e04e1e2266Cc39a1109E` |
| EnsPairFactory | `0xF75298ef0e0A42aB92fa6C7ba6ef0bbd0B9C0c02` |

`depositToken` is tUSDC `0x571c992873D31310B11Bf6bF6B44f2748B4bce8C`. `depositAmount` is `100000000` (100 tUSDC, 6 decimals). `house` is `0x79bC47e448b1B52F3DE651a0d102FD73FaDD7B7C`. Resolver is `address(0)`. `parentLabel` remains `rival`.

`RivalNames` holds root `ROLE_REGISTRAR | ROLE_RENEW | ROLE_UNREGISTER` (`0x11001`) on resource 0. The deployer `0xFeAf5C921996FC53f4DEf35e181E766e6D74690A` keeps `ALL_ROLES` from the `PermissionedRegistry` constructor. That residual bitmap is not in `specs/ens-roles.expected.json`.

`solvers.rival.eth` does not resolve. `rival.eth` was not bought, and this solvers registry is not a subregistry of a `.eth` name. A resolver lookup for `solvers.rival.eth` returns no resolver. Universal Resolver has no path to this registry.
