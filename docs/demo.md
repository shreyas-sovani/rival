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

## Judge journey on the web pages

Status of PRD §5.5 steps 1–6, 10, and 13 after the trade, auction, book, and solvers pages were wired. No new transaction hashes were produced in this pass. Steps that need the live runner or a real fill are marked not yet observed.

| Step | What the page does now | Observed |
| --- | --- | --- |
| 1 | Trade creates an on-device burner wallet and shows its address. Get test tokens is enabled when `/api/health` returns JSON. House tWETH and tUSDC do not disable it. The claim is an EIP-712 `FaucetClaim` posted to `/api/faucet`. The web domain's verifying contract is tWETH `0x45E6a5bD3be4D00E7Be57287D7d25De3F833253d`, the same address the runner uses as `chain.faucet`. A failed claim says `claim failed, try again`, `already claimed today`, or `The faucet is empty.` for a real mint failure. | Not yet observed in a browser. The production site has not been redeployed, so the live URL can still sign the zero-address domain and can still hide the button when the house balance is zero. |
| 2 | Trade reads the Sepolia pool and the hook TWAP for the curve preview. If either read fails, pegged mode stays off and the chart does not plot a 1 tUSDC preview as a pool price. The presence chip reads `GET /api/intents?pair=tWETH/tUSDC&status=open`. `source: "arkiv"` and `presence > 0` shows "N solvers online". `source: "degraded"` shows the banner `Book degraded: using runner feed`. | The public GET on 2026-11-07 returned HTTP 200, `source: "arkiv"`, `presence: 2`, and zero rows. The production site has not been redeployed, so the chip on that URL was not observed. |
| 3 | Sign & publish shows the plain-language signing summary, then signs the Permit2 witness and posts `{intent, signature}` to `/api/intents`. It stays blocked when the burner's tWETH balance is below the sell amount, with the text `Get test tokens first`. Success routes to `/auction?h=<intentHash>`. `degraded: true` stores the book-degraded banner. | Not yet observed. No intent was published from this worktree. |
| 4 | `/auction?h=` rebuilds the curve from the signed intent stored in this browser, and polls settlement `Filled` and `Cancelled` logs about every 4 seconds. A valid hash with no stored intent says `This browser has no signed intent for this hash. Sign on the Trade page.` It does not say a solver is still racing. | Not yet observed in a browser. No new fill. The absolute fill already listed above is not loaded as a receipt unless its log is read for that hash. |
| 5 | A `Filled` log builds the receipt with `receiptMath`: amount out, curve bps, fair output, improvement bps, solver address, and a Sepolia Etherscan link. The solver name is `label.solvers.rival.eth` only when the Sepolia universal resolver returns that solver's address. Otherwise the name stays blank. There is no receipt when the log is missing. | Not yet observed. The subname broadcast landed (`docs/ens-design.md`). `cast resolve-name` still reports no resolver, so a live name read can stay blank. |
| 6 | `/solvers` reads `SolverRegistry` `labelOf`, `isListed`, and `stats`, sorted by fills, then reads `label.solvers.rival.eth` through the Sepolia universal resolver. A matching address shows the name and a matches-ENS badge. A miss stays blank. The makers disclosure stays on the page. A successful read with rows does not show the registry-unavailable warning. | Not yet observed in a browser. The ENS broadcast is in `docs/ens-design.md`. `cast resolve-name` still reports no resolver. |
| 10 | Cancel signs settlement `Cancel` typed data and posts `{intentHash, deadline, signature}` to `/api/cancel`. Success shows cancelled and stops the poll. | Not yet observed. |
| 13 | `/book` polls the same open-intents endpoint every 10 seconds and shows pair, size, floor, deadline countdown, gate, a View entity link, and the copyable Arkiv query. Zero rows with `source: "arkiv"` use the empty title `no open intents`. A degraded feed, or a book that has not loaded, does not use that title. Solver heartbeats can still report solvers online while the table is empty. | The public endpoint on 2026-11-07 returned HTTP 200 with `presence: 2` and no open rows. This tree would title that result `no open intents`. The production Book page was not clicked in this pass. |

## Funding and ENS on 2026-11-07

Minted from the operator, which is the token minter. Relayer, atlas, house, and market maker already held enough Sepolia ETH, so no ETH top-up was sent.

| Wallet | Address | Mint |
| --- | --- | --- |
| House | `0x79bC47e448b1B52F3DE651a0d102FD73FaDD7B7C` | `10` tWETH `0xa621486c73d26db5c44d227327464e5a52a38ba3b13a39ccfa58e6838842cda5`, `20,000` tUSDC `0x6a07a99c4e2d1a26aa342613255d2c2866240a6162017d6aad908d1a4d5fd87c` |
| Market maker | `0x16A13b04775D733aEAAAb88d77A69d1b9ffA0062` | `5` tWETH `0x5cd63678d5056de5f2abf3b50d58d68f160d029a59b7bce29b57a4e86c57a14d`, `10,000` tUSDC `0xf4a37da631b5fccf2f00155d65f63ef531484ca9bcba227ea5ba955bbf0ef6d0` |
| Maker | `0xFc21eC9b802932918640F5Ce8f372E1A5b2EE81a` | `2` tWETH `0xb67dd41a7cae6b633b765dc0a87e0a9f2b02209560e5ea78a141fb58ca27cf81` |
| Maker | `0x7A23914e049954145c285F951D83b9a63C9D4Eda` | `2` tWETH `0x0ecfa9107a826b37a7cfd05e61e3e0202759527c330f75c5c714035854b96227` |

After the mint, `GET /api/health` showed house tWETH `10000000000000000000` and tUSDC `20000000000`. Oracle age was 90 seconds with 79 observations. Atlas and house heartbeats were up. The market maker heartbeat was not. Open intents were still 0 because the relayer that publishes maker intents had `0` tGLM. Operator sent `5` tGLM to `0x8cEa9b4F8C42464A3661b5ea08FD5EE566557c45` on Rabdi: `0x7c131ffe6d9e7268d76137f737653193b97573ad7cde52ced055dbf5588653dc`. The runner was restarted after that. A later `GET /api/intents?pair=tWETH/tUSDC&status=open` returned `source: "arkiv"`, presence `2`, and one row: intent `0xb197e8bf95dd9921a01823abe5b782b469a90d7efaa9d9a87aebedf032fe4201` from maker `0xFc21eC9b802932918640F5Ce8f372E1A5b2EE81a`. The Fly faucet secret was updated to the operator key. A clean-profile browser pass was not run. The Uniswap feedback form, the demo video, and the ETHGlobal submission were not sent. The ENS hashes are in `docs/ens-design.md`.
