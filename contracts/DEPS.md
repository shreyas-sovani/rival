# Contract dependencies

Vendored under `contracts/lib/` with git metadata removed (no submodules). Pins resolved 2026-11-06.

| Repo | Version | Commit | Resolved |
| --- | --- | --- | --- |
| [foundry-rs/forge-std](https://github.com/foundry-rs/forge-std) | tag `v1.17.0` | `f3dae6e6ee381f25eb6a246f7da9b85c91a68219` | 2026-11-06 |
| [Vectorized/solady](https://github.com/Vectorized/solady) | tag `v0.1.26` | `acd959aa4bd04720d640bf4e6a5c71037510cc4b` | 2026-11-06 |
| [OpenZeppelin/openzeppelin-contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) | tag `v5.7.0` | `cab19933c33c2ad1d4c7a84864a3601dddfd16f3` | 2026-11-06 |
| [Uniswap/v4-core](https://github.com/Uniswap/v4-core) | npm `@uniswap/v4-core@1.0.2` (`gitHead`) | `59d3ecf53afa9264a16bba0e38f4c5d2231f80bc` | 2026-11-06 |
| [Uniswap/v4-periphery](https://github.com/Uniswap/v4-periphery) | npm `@uniswap/v4-periphery@1.0.3` (`gitHead`) | `60cd93803ac2b7fa65fd6cd351fd5fd4cc8c9db5` | 2026-11-06 |
| [Uniswap/permit2](https://github.com/Uniswap/permit2) | latest tag `0x000000000022D473030F116dDEE9F6B43aC78BA3` | `cc306b601f172c51bc04334a109e98340456620b` | 2026-11-06 |
| [ensdomains/contracts-v2](https://github.com/ensdomains/contracts-v2) | default branch `main` | `48b3e2d39513b9dd32ef1850877a29009bc807b9` | 2026-11-06 |

`v4-core` is BUSL-1.1. The pinned `foundry.toml` in that commit uses `solc = "0.8.26"` and `evm_version = "cancun"`. This repo's `contracts/foundry.toml` uses the same compiler settings with `optimizer_runs = 200`.
