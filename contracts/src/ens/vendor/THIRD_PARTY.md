# Third-party ENS sources

`git submodule update --init --recursive` from this repository does not check out `ens-contracts`. There is no root `.gitmodules` gitlink, and `contracts/lib/contracts-v2` is not its own git repository, so the nested submodule recorded in `contracts/lib/contracts-v2/.gitmodules` cannot be initialized. `contracts/lib/contracts-v2/contracts/foundry.lock` pins `ens-contracts` at `3b1cc225ccdf64581d5fdc81db574f51ba5c8c09`.

## NameCoder

`NameCoder.sol` is copied from that commit (`contracts/utils/NameCoder.sol`, MIT). It does not compile alone. The same commit's `BytesUtils.sol` and `LibMem/LibMem.sol` are included because they are the only files `NameCoder` imports. They are not a vendor of the rest of `ens-contracts`.

## PermissionedResolver

`PermissionedResolver.sol` already lives at `contracts/lib/contracts-v2/contracts/src/resolver/PermissionedResolver.sol` (MIT, ENS contracts-v2). Copying it into this directory does not compile: it imports `@ens/contracts` resolver profiles, `@ensdomains/verifiable-factory`, and `@openzeppelin/contracts-upgradeable`, and those checkouts are the same missing submodule tree. A second copy under `contracts/src` would fail `forge build`.

Sepolia bootstrap does not compile this contract. It deploys a proxy of the canonical implementation `0x115eb53f0c60696633855f90b138178fb40b2b2c` through `VerifiableFactory` `0xda70306c98e97ece36f997a21368e53298572991`.
