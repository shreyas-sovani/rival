# What worked

- `RivalOracleHook` `0xb17a547082836fDF87001c1DE031fA8A2D391080` deployed with flag mask `0x1080` and salt `0x0000000000000000000000000000000000000000000000000000000000000d1d`. Pool A `consult(60)` returned tick `-196257` before and after the warming swaps (`docs/demo.md`, `docs/oracle.md`).
- Spike S1: `test_modelParity` passed on 1,000 sequences. The Sepolia fork test `test_fork_initializeHookedPool` initialized a fee-500, tick-spacing-10 pool on PoolManager `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`, added liquidity, and swapped once (`docs/spikes/S1.md`).
- Spike S2: a viem `signTypedData` signature over `PermitWitnessTransferFrom` recovered to the maker on the same digest `@uniswap/permit2-sdk@1.4.1` `SignatureTransfer.hash` produces. Solidity `intentHash` matched that witness. The hash was not weakened (`docs/spikes/S2.md`).
- The absolute fill `0xeadff32d9c91c28bab2c9dc8136c7d1a2ef2c0091085f1a0e2d891645e9500ec` landed. `msg.sender` is `atlas` (`0xD2aA21AF4faa840Dea890DB2C6649AACF2C80Ff3`), delegated to `UniswapSolver` `0xDBe8a61e1A4cDd767FfA7C822C242B8E85414e17`. The temporary delegation was cleared in `0x9ab62bb28557604429282780370e39499c62645fc2b8e075b65aea456a781d05` (`docs/demo.md`).

# Where we got stuck

## Hook salt mining

`BaseHook` rejects a deploy whose address flags do not match `getHookPermissions`. The search is CREATE2 over `type(RivalOracleHook).creationCode ++ abi.encode(poolManager)` until `(address & 0x3fff) == 0x1080`. In Foundry tests the deployer is the test contract (`HookMiner.find(address(this), ...)`). A forge-script broadcast has to mine against the CREATE2 deployer `0x4e59b44847b379578588920cA78FbF26c0B4956C`. A salt mined for `address(this)` will not deploy in the broadcast. Reproduction: `docs/spikes/S1.md`. The deployed salt is in `deployments/sepolia.json`.

## Flag bits

`afterInitialize` is `1 << 12` (`0x1000`). `beforeSwap` is `1 << 7` (`0x80`). The mask is `0x1080`. No delta-return flags and no fee override. `Hooks.ALL_HOOK_MASK` is the low 14 bits (`0x3fff`). `getHookPermissions` is `contracts/src/hook/RivalOracleHook.sol` lines 48–65. Reproduction: `docs/spikes/S1.md` and `test_permissionsBitmap`.

## Permit2 witness type string

The witness suffix copied into `RivalSettlement.WITNESS_TYPE_STRING` is:

```
Intent witness)Intent(address maker,address tokenIn,address tokenOut,uint128 amountIn,address recipient,uint8 mode,uint128 baseOut,uint32 oracleWindow,int32 startBps,int32 floorBps,uint32 startTime,uint32 decaySecs,uint32 deadline,uint128 hardMinOut,uint8 gate,bytes32 allowlistHash,uint256 nonce)TokenPermissions(address token,uint256 amount)
```

Permit2 prepends `PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,`. The spender is the settlement contract. `contracts/lib/permit2/src/Permit2.sol` is `pragma solidity 0.8.17` and imports solmate, which is not checked out, so this repo's solc `0.8.26` pin cannot link that contract. The fill tests deploy `LocalPermit2`. The witness hash is `PermitHash.hashWithWitness` from the pinned library. Reproduction: `docs/spikes/S2.md`. Fixture digest `0x4580ff53badece96246515300f5511f971a9987d2cbad010712e2c5a39910060`.

## Flash accounting settlement

`UniswapSolver.rivalFillCallback` (lines 57–83) calls `poolManager.unlock`. `unlockCallback` (lines 86–90) calls `_swap` (lines 97–118): `swap`, then `_pay` (lines 120–124) does `sync`, transfer, and `settle`, then `take`. `Shortfall` reverts if the input left on the solver is non-zero, the output is under `requiredOut`, or `settle` returns a different amount. The absolute fill above completed this path. This file does not record a failed flash-accounting transaction.

## Quoter on-chain vs off-chain use

`RivalOracleHook.quote` is a mid at the TWAP tick. It does not include fees or price impact (`docs/oracle.md`). The v4 quoter is a separate `eth_call`. `scripts/demo-live.ts` lines 669–679 call `quoteExactInputSingle` on `0x68aFa8b853cAa7a2D40B0F6AEE5C4DbC147C8244`. That call reverted. The script used a fixed floor. `docs/demo.md` records hard floor `1799099` tUSDC base units and does not record the revert data. `packages/solver-sdk/src/run.ts` lines 94–108 ask a `VenueQuoter` port for the same kind of quote before a bot would fill. `packages/solver-sdk/src/quote.ts` lines 12–19 only net gas out of an amount already in hand.

## StateView

Off-chain checks call StateView `0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C` `getSlot0`. `scripts/pools-deploy.ts` `readSlot0` is lines 124–140. `contracts/script/DeployVenue.s.sol` `_checkSlot0` is lines 236–239, and lines 60–61 revert `LensMissing` if that contract or the quoter has no code. The hook does not use StateView. It reads `poolManager.getSlot0` in `recordObservation` (line 135) and `_tickEnd` (line 179).

## Test environments on Sepolia

S1's fork test ran against the canonical PoolManager and was not skipped (`docs/spikes/S1.md`). If `SEPOLIA_RPC_URL` is unset, that test calls `vm.skip`. S2 did not fork Sepolia. The fixture signature is bound to canonical Permit2 and to settlement `0x1111111111111111111111111111111111111111` on chain id `11155111`. S3's `RivalNames.fork.t.sol` skipped because `SEPOLIA_RPC_URL` was unset. The local result was 24 passed, 0 failed, 1 skipped (`docs/spikes/S3.md`). Later broadcasts did land. Their addresses are in `deployments/sepolia.json`.

# Docs gaps

| Page | Missing sentence |
| --- | --- |
| Hook deploy notes, as we had to reconstruct them in `docs/spikes/S1.md` | Mine the salt against the CREATE2 deployer `0x4e59b44847b379578588920cA78FbF26c0B4956C` for a broadcast. Mining against the test contract's address produces a salt that will not deploy. |
| Permit2 witness docs, as we had to pin the string in `docs/spikes/S2.md` | The full type string, including `Intent witness)` and the trailing `TokenPermissions(...)`, is part of the digest. `Permit2.sol` in the tagged tree does not compile under solc `0.8.26` when solmate is absent. |
| `docs/demo.md` next to the absolute fill | The V4Quoter call reverted and the script substituted a fixed floor. The page records hard floor `1799099` and does not record the revert data. |

# DX wishes

- `HookMiner.find` should print the deployer it mined for, the salt, the address, and the flag mask in one example. The split between `address(this)` in tests and `0x4e59b44847b379578588920cA78FbF26c0B4956C` in a broadcast cost a reading of `docs/spikes/S1.md` before the venue script was safe.
- A Permit2 fixture (type string, domain, digest, signature) that a solc `0.8.26` project can check without compiling `Permit2.sol`.

# One highest-impact improvement

Publish that Permit2 witness fixture next to the signature-transfer docs. One character in the witness suffix changes the digest, and this checkout cannot link `Permit2.sol`. Spike S2 kept the hash strict and used `LocalPermit2` plus `PermitHash.hashWithWitness` instead. A published fixture would make that check the default.

# Time-to-first-success

| Path | Time |
| --- | --- |
| Hook deployment | not measured. S1 decided GO for the design and did not broadcast. The Sepolia hook address is the later `DeployVenue` deploy in `deployments/sepolia.json`. |
| Permit2 witness | not measured. S2 recorded a matching digest and a recovered viem signature. It did not record a clock time. |
