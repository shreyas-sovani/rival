# ENS names and the solver registry

`SolverRegistry` takes a listing deposit and issues one ENSv2 label per solver. `RivalNames` is the only contract that calls the solvers registry. Gating reads `ownerOf` and fails closed. `syncRecords` stores `com.rival.*` in `RivalNames` and, when the resolver immutable is non-zero, also calls `setText` on `label.solvers.rival.eth`. The Sepolia deployment still passes `address(0)`, so the live contract does not call `setText`. See the founder broadcast section below.

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

Solver-editable keys (`description`, `url`, `avatar`, `agent-context`, `agent-endpoint[web]`, `agent-registration[11155111]`) are `ROLE_SET_TEXT` on the key. The canonical Sepolia resolver's `setText(bytes name, string key, string value)` checks `resource(key) = uint256(keccak256(bytes(key)))`. `grantSetterRoles` grants that role. `com.rival.fills`, `com.rival.makers`, `com.rival.avgImprovementBps`, and `com.rival.lastFill` are granted only to `RivalNames`. An account without that role, including a random address, reverts `EACUnauthorizedAccountRoles`. The operator's resolver root bitmap is `ROLE_SET_TEXT_ADMIN` plus the upgrade roles. That admin bit can grant `ROLE_SET_TEXT` and does not itself pass `setText`. The in-repo `PermissionedResolver.sol` still has the older `setText(bytes32,string,string)`. The Sepolia implementation verified on Sourcify (2026-10-01) is the `bytes` form. Bootstrap and the Evidence call use the deployed form.

`git submodule update --init --recursive` does not populate `ens-contracts`. This checkout has no `.gitmodules` gitlink, and `contracts/lib/contracts-v2` has no `.git`. `NameCoder` and `PermissionedResolver` therefore are not compiled from a submodule. Bootstrap uses the canonical deployed `PermissionedResolver` implementation through `VerifiableFactory`. It does not compile those contracts.

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

`RivalNames.syncRecords` writes those four numbers into `protocolRecord(solver)`. If `resolver` is `address(0)`, it returns after that write. If `resolver` is set and the solver has a stored label, it calls `setText(bytes,string,string)` for the four `com.rival.*` keys. The `bytes` argument is the DNS encoding of `label.solvers.rival.eth`. A resolver revert rolls the storage write back. The parent label in that name is the constant `rival`. A fallback parent (`rivalx` or `rivalmarket`) does not retarget it. A direct call from any address other than the registry reverts `Unauthorized`.

The deployed `RivalNames` was constructed with `resolver = address(0)`. That bytecode does not contain the `setText` branch. Publishing the text records on Sepolia is the bootstrap script's snapshot, not a call into the deployed `syncRecords`.

`RivalNames.renew` passes `max(currentExpiry, expiry)` into ENS `renew(anyId, newExpiry)`, because the pinned function reverts `CannotReduceExpiry` when the new timestamp is earlier. It renews by timestamp, not by duration.

## Exit and lapse

`exit` requires a stored label (`Unauthorized` otherwise). It calls `unregister`. If that reverts, `exit` reverts and the deposit stays. On success it clears the label and refunds exactly `depositAmount`.

On the pinned registry, `unregister` reverts `LabelExpired` once `block.timestamp >= expiry`. A lapsed solver therefore cannot `exit` until the name is live again. `renew` from `RivalNames` can revive an expired name, because the root `ROLE_RENEW` grant makes `PermissionedRegistry._canRevive` true. `onFill` does that renew inside `try/catch`. After a successful revive, `ownerOf` is the solver again and `exit` can unregister and refund.

Stats are not cleared on `exit`. A later registration keeps the counters and the seen-maker set.

## Fallback

Primary per-record ENS text is not written by the deployed `RivalNames` bytecode. `com.rival.fills`, `com.rival.makers`, `com.rival.avgImprovementBps`, and `com.rival.lastFill` are the `protocolRecord` view on that contract. The source calls `setText` when a future `RivalNames` is constructed with a non-zero resolver. The 2026-11-07 bootstrap wrote a snapshot of those values onto resolver `0x8e4116c947fefb774690b0377e12d40d22013b14`. Later fills do not update that snapshot. ENS identity remains register, `ownerOf`, renew, unregister. Gating still uses `ownerOf` and fails closed.

## Sepolia deployment

Deployed with `contracts/script/DeployNames.s.sol`. `MockLabelStore`, `PermissionedRegistry`, and `EnsPairFactory` are CREATE2 deployments. The factory then CREATE-deploys `RivalNames` and `SolverRegistry`, so each constructor is given the other's predicted address. The label store is `MockLabelStore` from `contracts/test/ens/EnsHarness.sol`. No `.eth` parent was registered. H-006 stays waived.

| Contract | Address |
| --- | --- |
| MockLabelStore | `0x3c328efaFa5a2493121e824695C791f78Ee5D360` |
| PermissionedRegistry (`ens.solversRegistry`) | `0xCEec9D7ADcad00e4D842283d9526E75C9440b36f` |
| RivalNames (`names`) | `0xC20a61e830bB91A69C1B6BCcd607299152aDE797` |
| SolverRegistry (`registry`) | `0x6AD5C78fA2278d397Bb7e04e1e2266Cc39a1109E` |
| EnsPairFactory | `0xF75298ef0e0A42aB92fa6C7ba6ef0bbd0B9C0c02` |

`depositToken` is tUSDC `0x571c992873D31310B11Bf6bF6B44f2748B4bce8C`. `depositAmount` is `100000000` (100 tUSDC, 6 decimals). `house` is `0x79bC47e448b1B52F3DE651a0d102FD73FaDD7B7C`. The deployed resolver argument is `address(0)`. `parentLabel` in `deployments/sepolia.json` remains `rival` until a broadcast says otherwise.

`RivalNames` holds root `ROLE_REGISTRAR | ROLE_RENEW | ROLE_UNREGISTER` (`0x11001`) on resource 0. The deployer `0xFeAf5C921996FC53f4DEf35e181E766e6D74690A` keeps `ALL_ROLES` from the `PermissionedRegistry` constructor. That residual bitmap is not in `specs/ens-roles.expected.json`. `scripts/ens-role-check.ts` reads `roles(uint256,address)` on this registry. A zero address is the only case that prints `BLOCKED: solvers registry or RivalNames address is zero`. The registry is deployed.

## Canonical Sepolia ENSv2

Verified 2026-11-06 from [docs.ens.domains/learn/deployments](https://docs.ens.domains/learn/deployments/) under "Sepolia (ENSv2)". These are the values in `deployments/sepolia.json` and `apps/web/src/data/public-deployment.ts`.

| Contract | Address |
| --- | --- |
| ETHRegistrar | `0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3` |
| ETHRegistry | `0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4` |
| RootRegistry | `0xb458d6a3a77919449d03e7a6903c26827c1ec43f` |
| UserRegistryImpl | `0x9bd8a88719068d09ecee662f36c0e3856708366a` |
| VerifiableFactory | `0xda70306c98e97ece36f997a21368e53298572991` |
| PermissionedResolverImpl | `0x115eb53f0c60696633855f90b138178fb40b2b2c` |
| UniversalResolverV2 | `0x24e1d8e068620b647ca097f961a61055f4f42d72` |
| Universal resolver proxy | `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` |
| MockUSDC (fee token, open `mint`) | `0x240b0316df57887dbbe58b586508b19e633a14aa` |

Web name reads call `findResolver` on the universal resolver proxy. They do not use a second registry client.

## Founder broadcast

Nothing in this section has been sent. `SEPOLIA_RPC_URL` and `OPERATOR_PRIVATE_KEY` were not in the environment or in `secrets/.env.local` when the scripts were written. The scripts print `BLOCKED` and the command below. They do not print the key.

Parent registration, label order `rival`, then `rivalx`, then `rivalmarket`:

```bash
pnpm exec tsx scripts/ens-register-parent.ts
```

The script mints MockUSDC to the operator, approves the ETHRegistrar, `commit`s, waits `MIN_COMMITMENT_AGE`, and `register`s. It prints the transaction hashes and `ENS_PARENT_LABEL`. If the operator already owns a candidate, it prints that label and does not register another. Put `ENS_PARENT_LABEL` in `secrets/.env.local`.

Broadcast on 2026-11-06: `rival.eth` register `0x1d9740fccaa1506b12584e4e23c49ecdb92e96293d904b7d7d195a942c4679f6`. `getOwner(keccak256("rival"))` is the operator. `ownerOf(bytes32)` with the ENSIP-1 namehash reverts on this ETHRegistry.

Subname broadcast on 2026-11-07. The first `deployProxy` prediction omitted `--from`, so it named empty addresses. Those deploys actually created user registry `0xd5cf9458c645f97febf433461fb77870ae01c01c` (`0x23281b9d420b436b2e71e548dfeb92b826e00fdfceb947bd7ca49da8b31fac5b`) and resolver `0x8e4116c947fefb774690b0377e12d40d22013b14` (`0xe88ac9a3fb21ed08560f1bdcf0f5c1d98f72eb76d69a990e23069d8c025c12c8`). A follow-up with `ENS_USER_REGISTRY` and `ENS_RESOLVER` set to those addresses corrected the parent: `setSubregistry` `0xf2c3b2bc1cbd9e06a3a7bf5e81e59de254cfd3bd57b13d4f9176b6684dcaef29`. `register` solvers `0xd89140375b9c3543ff7d8475a7b2ba6ddbc52805075b7a48eeac55c014ad3dc9`. Atlas `setResolver` `0xb5a94a60e946484ede4ab4df8c6a7a5080366b81aecd7ad4e9e0c76a818e5414`. ETHRegistry `getSubregistry("rival")` is the user registry. That registry's `getSubregistry("solvers")` is `0xCEec9D7ADcad00e4D842283d9526E75C9440b36f`. The atlas resolver is `0x8e4116c947fefb774690b0377e12d40d22013b14`. `TextChanged` on setText `0x38f1841e5cd7239e1b81c7f7e6c15731ab078f1d7e54990652e810e622a8c84c` records `description` = `Rival solver atlas (sprint).` `cast resolve-name atlas.solvers.rival.eth` still reports no resolver. `text(bytes32,string)` on that resolver reverted with empty data.

Wiring `solvers.<parent>.eth` to the deployed solvers registry and a PermissionedResolver:

```bash
ENS_BOOTSTRAP_BROADCAST=1 pnpm exec tsx scripts/ens-bootstrap.ts --broadcast
```

`--broadcast` without `ENS_BOOTSTRAP_BROADCAST=1` throws `BroadcastDisabled`. The broadcast deploys a UserRegistry proxy (`initialize((address,uint256)[])`), `setSubregistry` on the parent, `register`s `solvers` with subregistry `0xCEec9D7ADcad00e4D842283d9526E75C9440b36f`, deploys the resolver (`initialize((address,uint256)[],bytes[])` with `ROLE_SET_TEXT_ADMIN` and the upgrade roles), grants text roles with `grantSetterRoles`, snapshots `protocolRecord` into `com.rival.*`, and `revokeRoles` the operator on those four keys. If `setResolver` on an existing solver label reverts, the log prints the `cast send` for the deployer key. That step is not invented here.

`cast resolve-name atlas.solvers.rival.eth` still reports no resolver after the broadcast. Do not treat that message as proof the subregistry is unset. The reads above are the check.

## Evidence page

`/evidence` does not print the old "not simulated" strings.

- **Unlisted solver tries a gated fill** runs `eth_call` of `RivalSettlement.fill` with `gate = listed` and `from` an address that is not the maker or the recipient. The page shows the calldata and the revert string (`NotListed` when the gate check is what reverts).
- **Try to forge a track record** runs `eth_call` of `setText` for `com.rival.fills` from a second unused address. The target is the resolver `findResolver` returns for `atlas.solvers.<parent>.eth` on the universal resolver proxy. If that resolver is unset, the call uses the canonical PermissionedResolver implementation, which still enforces `ROLE_SET_TEXT`. The page shows the calldata and the revert string.
- The ENS role list is `roles(0, RivalNames)` from the deployed solvers registry, formatted as named bits. The address list includes the eight canonical contracts and the `rival.eth` namehash.

No key is required. The calls use the public Sepolia RPCs already allowed by the site content security policy.
