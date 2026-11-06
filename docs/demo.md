# Live Sepolia demo

Pool A, the oracle hook, RivalSettlement, and UniswapSolver. Hashes and statuses only.

## Step 1 — warm pool A

Status: DONE

Oldest observation timestamp: 1793958588.

consult(pool A, 60) before swaps: works, tick -196257.

Mint tWETH for warming swaps: 0x48e88be56039fd6d7f43e814c28c45871c5c0305f2f08bb8b72bffa14ac8af44

Approve PoolSwapTest for tWETH: 0x620db000245ebb5554df039b025bfaf2c075711eb00ee1fef11f6524b123274e

Approve PoolSwapTest for tUSDC: 0xf0b6c17566781bb340bd8e78fb5d003b5063bd32890747c6283ca95b25b17996

Swap tWETH to tUSDC: 0xa495415f11104b83ef1b52153dcb3c2780eece6e9112a73b45a863a4c5209ed0

Swap tUSDC to tWETH: 0x39fb54d481e361fabdb2903bf9f685df2fecb59458a9a66a97fe4fbafdaa497c

Oldest observation timestamp after swaps: 1793958588.

consult(pool A, 60) works, tick -196257.

## Step 2 — register solver

Status: DONE

Solver label: atlas

Solver address: 0xD2aA21AF4faa840Dea890DB2C6649AACF2C80Ff3

Mint 100 tUSDC: 0x97a3fc289c2f0ac8b0dcdb725ea40e1d8144a3304e80be9852f880951152a024

Approve registry: 0xbe019226c97e2e5609844a52a6ccf06d7173b27b3a269eacbc1ef9f1f9747510

register("atlas"): 0xeb84111137557cecc2fb0954eb8eb8ebd26d6c78aca6174b96b08d91e48d16de

## Step 3 — absolute fill

Status: DONE

Mint maker tWETH: 0x1b35d519f05bced8409a62bd1086149b9951c2a79ee60137ad4e4cb4eb646af8

Maker tWETH allowance for Permit2 was already max.

ABSOLUTE curve 10s, start +20 bps, floor -20 bps, hard floor 1799099 tUSDC base units.

Fill: 0xeadff32d9c91c28bab2c9dc8136c7d1a2ef2c0091085f1a0e2d891645e9500ec

msg.sender is the atlas solver. That transaction delegates the account to UniswapSolver so settlement's callback runs the solver swap.

Cleared the temporary solver delegation: 0x9ab62bb28557604429282780370e39499c62645fc2b8e075b65aea456a781d05
