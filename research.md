# ETHGlobal Mumbai — research brief

Researched 5 November 2026. This file records prize rules, sponsor statements, prior outcomes, and technical facts. It does not select a sponsor, rank tracks, propose a product, or specify an architecture.

Primary inputs: the local prize export `prizes.txt` (same structure as the live prizes index) and pages fetched the same day. Amounts below are copied from those cards. Where a live system was probed, the probe time is about 16:05–16:20 UTC on 5 November 2026.

## How to read claims

| Label | Meaning |
| --- | --- |
| Card | Text on the ETHGlobal Mumbai prize page or `prizes.txt`. |
| Organizer | ETHGlobal’s own event pages. |
| Docs | The sponsor’s documentation, fetched or searched on 5 November 2026. |
| Live | An HTTP probe run for this brief. |
| Showcase | The project’s own ETHGlobal showcase page. |
| Index | A secondary winner index (Medalist, BuildPodium, Tensor Hack, Outposts). Useful, not the organizer of record. |
| Claim | A team or sponsor post that was not matched to a showcase “Winner of” field in the pages opened here. |

Medalist pages used: [Lisbon 2026](https://medalist.build/hackathons/ethglobal/lisbon2026), [New York 2026](https://medalist.build/hackathons/ethglobal/newyork2026), [Tokyo 2026](https://medalist.build/hackathons/ethglobal/tokyo2026). Those three events are the recent in-person set indexed here. Absence from them is not proof a sponsor never ran a prize.

## Event mechanics

Sources: [Mumbai details](https://ethglobal.com/events/mumbai/info/details) (fetched in full) and [Mumbai prizes](https://ethglobal.com/events/mumbai/prizes). A search snippet of [Mumbai start](https://ethglobal.com/events/mumbai/info/start) is cited only where noted. A direct fetch of the start page timed out.

### Deadline and submission

- Submission deadline on the details page: **Saturday 7 November 2026, 09:00 IST**. Late submissions are not accepted.
- Submission is through the Hacker Dashboard: title, description, repository link.
- On the last step, a team may select **up to 3 partner prizes**. If one partner has several tracks, eligibility for all of those tracks counts as **one** of the three selections. The details page says this selection is the only way partners assess the project.
- Two submission modes: “Finalist and Partner Prizes”, or “Partner Prizes Only”.

### Tracks

Classic / from scratch, from the details page: project-specific code, designs, and assets must begin after the hackathon starts. Public libraries and starter kits are allowed. Work built before the event may still be submitted but **will not qualify for partner prizes or the Finalist category**.

Continuity, from the same page: an existing codebase is allowed under that track’s rules. The submission must document pre-existing work and include new features built during the hackathon. Partner eligibility “may vary by event and partner.” On this prize card, continuity-only tracks are marked in the inventory below. Several of them also require a dated “before” artifact (commit, prior submission page, or a README split).

### Version control, reuse, AI

- Large single commits or missing history **may** be disqualified. 1inch and Whitechain repeat a commit-history requirement on their own cards.
- Reused libraries must be distinguished from new work.
- AI tools are permitted. The submission must say where and how they were used, including files or assets. A submission that relies entirely on AI without meaningful team contribution may be ineligible for partner prizes and finalist consideration.
- Spec-driven workflows are permitted. Spec files, prompts, and planning artifacts must be in the repository.

### Finalist judging

- Live session: **7 minutes** = 4 minutes demo + 3 minutes questions.
- Criteria on the details page: technicality, originality, practicality, usability (UI/UX/DX), wow factor.
- Example questions listed by the organizer: what inspired the project; what tools were used and why; what challenges were solved and how. These are examples, not an extra scored rubric.

### Finalist cash and non-cash

Per person, from the prize card:

| Team size | Prize / person | Travel / person |
| --- | ---: | ---: |
| Solo | 250 USDC | None |
| 2 people | 250 USDC | 250 USDC |
| 3–5 people | 1,000 USDC | 500 USDC |

Travel reimbursement is usable toward one in-person ETHGlobal hackathon within 365 days. The card does not state a cap on the number of finalist teams.

Finalist pack, every finalist, not cash: **$828 off ETHGlobal Plus** (Stripe checkout), a **finalist hoodie**, and **$10,000 in AWS credits** via `eg.to/how-to-aws` and an OrgID. AWS is the named provider.

### Partner judging — two organizer pages disagree

Fetched details page: partners judge **submitted materials**. A booth visit is optional feedback and networking, and is **not required** for partner judging. Winners are announced at the closing ceremony. Partner-specific rules can add requirements.

Search snippet of the start page (not re-fetched; curl timed out): “For partner prizes, you’ll present your project at the partner booths in the venue.” The same search snippet also says judging criteria are creativity, functionality, technical difficulty, and impact, which is a different four-item list from the five criteria on the details page.

Treat the details page as the fuller fetched source. The booth sentence is unresolved until the start page is read directly.

### Demo video — organizer versus sponsor caps

ETHGlobal details page: the video is **optional** for the ETHGlobal upload, but if uploaded it must be **2–4 minutes** and at least **720p**. Upload fails under 720p or over 4 minutes. The page says a team will be asked to resubmit if the video is sped up, is a phone recording, uses music with text instead of speech, or uses a text-to-speech / AI voiceover. Slides should stay at or under 4 bullets. Introductions should stay short (the page says not more than 20 seconds of backstory).

Several sponsors require their own video and set a different cap. Hedera’s tracks say **5 minutes or less**. Whitechain says **2 to 4 minutes**. Ethereum Foundation CROPS says **3 minutes max**. 0G says **under 3 minutes**. A video that satisfies a 5-minute sponsor cap can fail the ETHGlobal uploader. Whether a sponsor watches the ETHGlobal upload, a separate link, or both is not stated on the cards.

## Cash inventory

Partner pools below sum to **$144,500**. That sum is arithmetic over the 12 partner headers on the card. ETHGlobal does not print a grand total on the pages fetched. Finalist USDC is per person and is not inside the $144,500.

“Continuity only” means the card labels the track as only for Continuity Track participants. Payout shape is how the card splits the pool, not a prediction of who gets paid.

| Partner | Header | Track | Continuity only | Payout shape | Track sum |
| --- | ---: | --- | --- | --- | ---: |
| World | $12,500 | World ID Agent Pass | Yes | $1,500 / $1,000 | $2,500 |
| World | | World ID Agent Pass | No | $2,500 / $1,500 / $1,000 | $5,000 |
| World | | Best Use of IDKit | No | 2 × $1,250 | $2,500 |
| World | | Best Use of IDKit | Yes | 2 × $1,250 | $2,500 |
| 1inch | $7,000 | Build an Aqua App | No | $2,500 / $1,500 / $1,000 | $5,000 |
| 1inch | | Build an Aqua App | Yes | $1,500 / $500 | $2,000 |
| 0G | $15,000 | Build with 0G Private Computer | No | $2,500 / $1,500 / $1,000 | $5,000 |
| 0G | | Physical AI: Agents with a Body | No | $2,500 / $1,500 / $1,000 hardware | $5,000 |
| 0G | | Keep Building on 0G | Yes | 2 × $1,500 | $3,000 |
| 0G | | Agents That Pay for Themselves | No | 2 × $1,000 | $2,000 |
| Uniswap Foundation | $15,000 | Build with Uniswap | No | $4,000 / $3,000 / $2,000 / $1,000 | $10,000 |
| Uniswap Foundation | | Build with Uniswap | Yes | 4 × $1,250 | $5,000 |
| Arc | $15,000 | Best DeFi / onchain finance app in Arc Studio | No | $3,000, no 2nd/3rd printed | $3,000 |
| Arc | | Best mobile web consumer agent using Discovery API | No | $3,000, no 2nd/3rd printed | $3,000 |
| Arc | | Best smart contracts with advanced stablecoin logic, in Arc Studio | No | $3,000, no 2nd/3rd printed | $3,000 |
| Arc | | Best use of Bridge Kit for non-USDC assets, in Arc Studio | No | $3,000, no 2nd/3rd printed | $3,000 |
| Arc | | Bring your project to Arc | Yes | $3,000, no 2nd/3rd printed | $3,000 |
| Hedera | $15,000 | AI Agents That Pay: x402 on Hedera | No | $3,000 / $2,000 / $1,500 | $6,500 |
| Hedera | | Tokenize Anything with Hedera Studios | No | $2,500 / $1,500 / $1,000 | $5,000 |
| Hedera | | “No Solidity Allowed” | No | 2 × $1,000 | $2,000 |
| Hedera | | Built on Hedera | Yes | 2 × $750 | $1,500 |
| Arkiv | $15,000 | Mirror something Ethereum depends on | No | $3,000 / $1,000 | $4,000 |
| Arkiv | | Build on Arkiv (from scratch) | No | $3,000 / $1,000 | $4,000 |
| Arkiv | | Build on Arkiv (existing projects) | Yes | $3,000 / $1,000 | $4,000 |
| Arkiv | | Node tooling | No | $2,000, places not split | $2,000 |
| Arkiv | | Arkiv + Swarm bonus (from scratch) | No | $500 | $500 |
| Arkiv | | Arkiv + Swarm bonus (existing) | Yes | $500 | $500 |
| Whitechain | $15,000 | Operate · stablecoin payments for business | No | $2,500 / $1,500 / $1,000 | $5,000 |
| Whitechain | | Tokenize · real world finance | No | $2,500 / $1,500 | $4,000 |
| Whitechain | | Scale · payments nobody notices | No | $2,000 / $1,000 | $3,000 |
| Whitechain | | Continuity · bring your product to Whitechain | Yes | 2 × $1,500 | $3,000 |
| Ethereum Foundation | $15,000 | Best Use of Anon-RPC | No | $2,500 / $1,500 / $1,000 | $5,000 |
| Ethereum Foundation | | Frame Transaction Alternative Mempool | No | $2,500 / $1,500 / $1,000 | $5,000 |
| Ethereum Foundation | | Best CROPS App | No | $2,000 / $1,000 / $500 | $3,500 |
| Ethereum Foundation | | Best CROPS Upgrade | Yes | $1,500, places not split | $1,500 |
| ENS | $10,000 | Best Use of ENSv2 | No | $3,000 / $2,000 / $1,000 / $1,000 | $7,000 |
| ENS | | Best Integration of ENSv2 into an Existing Project | Yes | $2,000 / $1,000 | $3,000 |
| Definitive | $5,000 | Best Use of Flash Advanced Orders in a Social App | No | $2,500, no 2nd/3rd printed | $2,500 |
| Definitive | | Most Creative Use of Flash Advanced Orders | Yes | $2,500, no 2nd/3rd printed | $2,500 |
| Chainlink | $5,000 | Best workflow with CRE | No | $1,500, places not split | $1,500 |
| Chainlink | | Best use of Chainlink CCIP 2.0 | No | 2 × $1,750 | $3,500 |

### Caps that are written on a card

These are sponsor rules, not an inference from the “3 partner selections” rule.

- **Ethereum Foundation:** “One EF prize per project.” A project may be submitted to Anon-RPC, the alt mempool, and CROPS. “You will be placed in at most one. EF judges decide where it fits best.” The continuity CROPS track repeats the one-prize rule.
- **Arkiv:** “Each team can win one Arkiv track prize; the Arkiv + Swarm bonus can come on top of it.” The card also says Arkiv’s prizes count as **one** partner prize on ETHGlobal, so the Swarm bonus does not use a second of the three partner picks. A project that uses only Swarm does not qualify for the bonus.
- **Hedera, Whitechain, World, 0G, Uniswap, 1inch, ENS, Arc, Definitive, Chainlink:** the Mumbai cards fetched here do **not** print a “one track per project” win cap. That is not the same as a promise that one project will be paid twice. It is an absence of a printed cap.
- **0G:** every 0G track on this card says prizes are paid **at 0G’s discretion**, and that not every place is guaranteed to be awarded if projects miss a quality threshold.
- **Whitechain:** “Prizes are paid by ETHGlobal in USDC under standard event eligibility rules.” Test tokens have no monetary value. The other cards do not all name the paying entity.

### Shared submission artifacts that are not on every card

| Artifact | Who requires it on this card |
| --- | --- |
| Public GitHub repo | Most tracks. ENS also accepts “Github or a similar platform.” Arc accepts GitHub **or Replit**. |
| `FEEDBACK.md` plus Uniswap’s hackathon feedback form | Uniswap, both tracks. Form: https://developers.uniswap.org/hackathon-feedback. The form must include the link to `FEEDBACK.md`. Missing it: “reviewed and audited before winners are finalized,” not an automatic reject in the sentence printed. README must point at the relevant contracts and lines. |
| `WHITECHAIN_FEEDBACK.md` | All four Whitechain tracks. |
| `/arkiv/friction.md` plus one markdown file per judging criterion, at the path printed on the card | All Arkiv tracks. Swarm adds `/arkiv/swarm.md`. |
| `CROPS` section in the README, one or two lines per letter | Both EF CROPS tracks. |
| Integration debrief (time to first success, friction, missing capability, one highest-impact improvement) | All four World tracks. |
| Short demo video posted on **both Discord and X**, tagging `@DefinitiveFi` | Both Definitive tracks, in addition to onchain execution in the final demo. |
| Shareable Arc Studio project URL, and Studio shown in the demo | Every Arc track. “Every Arc prize requires using Arc Studio as the starting point.” The card says to state which bounty the submission is for. |
| Open-source license named by the sponsor | Arkiv: a public repo with an open-source license, plus a statement of how AI was used. EF CROPS: MIT, Apache-2.0, GPL, MPL, or similar, and a user must be able to tell whether they can build and run it from the repo alone. |
| License of mirrored data | Arkiv mirror track: the data’s license must allow republishing, linked from the README. Sourcify data from any chain is excluded. |

## Source conflicts that change what “qualify” means

1. **Partner judging location.** Details page: materials, booth optional. Start-page search snippet: present at the booth. Unresolved. See above.
2. **ENSv2 production status.** [ENS blog, 27 October 2026](https://ens.domains/blog/post/ensv2-live-on-mainnet) says ENSv2 is live on Ethereum mainnet. [Deployments](https://docs.ens.domains/learn/deployments/) still says the ENSv2 contracts are on mainnet “ahead of the ENSv2 launch” and that “until the launch completes, resolution and registrations on Mainnet continue through the ENSv1 contracts.” [For App Developers](https://docs.ens.domains/ensv2/tutorial-app-developers/) says “ENSv2 is currently deployed on Sepolia for testing” and that the Universal Resolver proxy is the same address on mainnet and Sepolia. The Mumbai ENS card says “ENSv2 is now live on Ethereum mainnet” and accepts **mainnet or Sepolia**. These four statements were all visible on 5 November 2026. They do not agree.
3. **Hedera facilitator names.** The x402 card says settlement must go through a facilitator “listed in the Hedera docs (Official x402, Ax402, or Blocky402),” or one the team runs. The fetched docs page [Facilitators](https://docs.hedera.com/solutions/ai/x402/facilitators) lists **Official x402, Launa, and Blocky402**. It does not list Ax402. [ax402.io/facilitator](https://ax402.io/facilitator) describes a facilitator whose table in the search result shows Base (`eip155:8453`), not Hedera. “Ax402” on the prize card and “Ax402” the product are not established as the same thing by the docs page.
4. **Whitechain USDT address.** The prize requires USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` on chain ID 1874. A self-minted token “won’t count.” The [token list](https://docs.whitechain.io/build/block-explorer/token-list), version 1.1.0 generated 16 October 2026, lists a different USDT at `0xaa7962d073935D387e8d442DA1D7149C81388f46` and says that contract reports symbol `USDT.e`. Live explorer probe of the prize address returned name `Tether USD`, symbol `USDT`, decimals `6`, `total_supply` `1945270000000`, `holders_count` `91`, type `ERC-20`. The documented list and the prize address are different tokens.
5. **Relay’s ENS win versus Relay’s own write-up.** Index and Outposts record Relay as 1st place, Best Use of ENSv2, $3,000, at Tokyo 2026. Relay’s showcase “How it’s Made” says state lives in browser memory and resets on reload, and that “ENS is represented through the naming model; no ENS contracts … are integrated in this version.” Both texts exist. They describe different degrees of onchain integration.
6. **PolyAgents.** The showcase says the Cannes demo **simulates** HCS logs and HBAR payments in the frontend with `setTimeout`, while real SDK calls exist in `lib/hedera/`. The team’s LinkedIn post says they won the Hedera AI & Agentic Payments bounty at Cannes. Medalist lists a $3,000 Hedera prize for the project. The showcase page’s winner field was empty in the snippet retrieved; the index and the team post are the prize attributions.
7. **Agora versus ArcBook at Lisbon.** Outposts, quoting 1inch, lists ArcBook $2,500, Votive $1,500, KSwap-VM $1,000 on the from-scratch Aqua track, and Agora Markets $500 on continuity. Medalist’s Lisbon page matches ArcBook / Votive / KSwap-VM. A [1inch blog post, 24 September 2026](https://1inch.com/blog/post/1inch-hackathon-winners-agora) calls Arnau Briet “1inch track’s winner at ETHGlobal Lisbon” for Agora. “Track’s winner” in that headline is not the same split Outposts printed.
8. **Chainlink CCIP naming.** The Mumbai card says “CCIP 2.0” and links [docs.chain.link/ccip](https://docs.chain.link/ccip) plus a YouTube item titled “CCIP 2.0 LinkLab”. The docs index fetched the same day is organized around CCIP, a Cross-Chain Token standard, and **V1 → V2 migration** guides. This brief did not extract a sentence that defines the product name “CCIP 2.0” as identical to “V2”.

## Workshops printed on the card

All times IST, Thursday 5 November 2026, in person.

| Time | Room | Sponsor | Title on the card |
| --- | --- | --- | --- |
| 15:30 | Workshop Room 1 | 0G | One API, All of AI: Building on 0G Private Computer |
| 15:30 | Workshop Room 2 | Hedera | Hedera X Claude Code — AI Skills for Hackathon |
| 16:00 | Workshop Room 1 | ENS | ENSv2 — Identity for Apps, Agents & Beyond |
| 16:30 | Workshop Room 1 | Uniswap Foundation | How to Navigate the Uniswap Stack |
| 16:30 | Workshop Room 2 | Whitechain | How to Win on Whitechain, Tracks and Tips |
| 17:00 | Workshop Room 1 | Arc | Build Apps Powered by Smart Contracts with Arc Studio |
| 17:00 | Workshop Room 2 | Ethereum Foundation | Building with Anon-RPC and the alt mempool |
| 17:30 | Workshop Room 2 | 1inch | Reimagining the AMM with 1inch Aqua |

World, Arkiv, Definitive, and Chainlink show “Watch Video” or no in-person slot on the portion of the card read here. Chainlink’s Mumbai card does not print a room and time in `prizes.txt`.

---

## World — $12,500

Card: https://ethglobal.com/events/mumbai/prizes/world

About, in World’s words: developer stack for verified humans and AI-assisted interactions. World ID confirms a unique human without revealing identity.

### What the card says it wants

Both Agent Pass tracks: especially agentic products, but “any compelling use case is eligible.” Show an application that asks a person to authenticate or complete a **fresh** verification at the moment of the action. “Strong submissions will show a meaningful action that needs a human identity or approval layer, not simply a login screen added to an existing product.”

The from-scratch Agent Pass track prints, in the card’s own markers: “We are mocking proofs now, so you don't need sandbox app anymore” and “Proofs are using fake identities, DO NOT rely in them for production.”

IDKit, both tracks: a “real trust moment.” The credential should be proportionate. Listed examples of credentials: Proof of Human, Passport/NFC, Selfie Check (“Now live with Sybil score”). “We are not rewarding the most credentials used.” Examples of trust moments written on the card: scarce benefit, privacy-preserving eligibility, recovery or protection of an important account action, a workflow that becomes safer or simpler. The card says these are examples.

### Qualification, all four tracks

Agent Pass:

- Official World ID Agent Pass.
- Full journey: request, user completion, validated result, protected action.
- A denied, expired, cancelled, or otherwise unsuccessful path where the protected action does not occur.
- Validate on a secure backend. Do not expose client secrets. An unvalidated client response is not authorization.
- Written integration debrief, as specified above.

IDKit:

- Functioning application, mini app, or onchain flow.
- At least one supported credential, verified on the server or onchain “as appropriate.”
- Explain the product event and why that credential is the minimum sufficient assurance.
- A successful verification and one meaningful alternative path (cancellation, unavailable credential, rejection, or ineligible user).
- The same debrief.

### Links on the card

- Agent Pass product, docs, portal: https://auth.world.org/ , https://auth.world.org/docs , https://auth.world.org/portal
- IDKit example: https://idkit-js-example.vercel.app/
- IDKit guide: https://docs.world.org/world-id/idkit/integrate
- Credentials: https://docs.world.org/world-id/idkit/credentials
- Proof of Human: https://docs.world.org/world-id/credentials/1
- Passport/NFC: https://docs.world.org/world-id/credentials/9303
- Selfie Check: https://docs.world.org/world-id/credentials/11
- Verification flows: https://docs.world.org/world-id/idkit/verification-flows
- Developer portal: https://developer.worldcoin.org
- Continuity IDKit resources also list a simulator `https://simulator.worldcoin.org/id/0x18310f83` and an iOS TestFlight sandbox `https://testflight.apple.com/join/Tub7zuyD`. The from-scratch Agent Pass card says the sandbox app is no longer needed because proofs are mocked. The continuity IDKit card still links the sandbox and the simulator.

Live: `https://auth.world.org/` returned HTTP 200. `https://docs.world.org/world-id/idkit/integrate` returned HTTP 200. The docs bodies were not fully extracted.

### Prior outcomes

Tokyo 2026 card (https://ethglobal.com/events/tokyo2026/prizes/world) used almost the same Agent Pass text, then named “World ID for Agents,” including the mocked-proofs line, and paid **$2,500 × 3** rather than a 1st/2nd/3rd split. Medalist lists:

- Best Use of World ID for Agents, $2,500 each: **Airlock**, **Lifeline**, **Surety**.
- Best Use of IDKit, $2,500 each: **Placed**, **Pupille**.
- Continuity IDKit: **Lortnoc Tahc**, $2,500.

BuildPodium’s one-line description of Airlock: “Human-consent gateway for AI agents. AI for power, humans for consent, blockchain for certainty.” That sentence is an index blurb, not a technical review.

Lisbon 2026 World pool was a different product mix (Medalist): AgentKit use cases (HORS $4,000, BookerBob $2,500, Turing Swap $1,500), Identity Check Beta (Hands Unchained $1,750), Selfie Check Beta (BananaMesh $1,000, Commitment Issues $750), plus continuity placements. Hands Unchained’s showcase describes verified humans teleoperating robots, with World as a winner line alongside 0G. The Lisbon World card is not the Mumbai Agent Pass card.

Cannes 2026 showcase [VEIL VPN](https://ethglobal.com/showcase/veil-vpn-c643n) records “World - Best use of World ID 4.0, 1st place” and an ENS creative-use 1st place. [AgentPass](https://ethglobal.com/showcase/agentpass-92p9u) (Cannes, winner field not shown in the retrieved page) describes IDKit v4 on the client, server-side `signRequest`, and verify against `developer.world.org/api/v4/verify/:rpId`. The write-up says the v4 API returns `nullifier`, not `nullifier_hash`.

### Repeated shapes already public

Across 2026 cards and showcases, the sponsor text keeps rejecting “a login screen added to an existing product,” and the winning blurbs that were retrieved cluster on a human gate in front of an agent action, a labor market, or a VPN/identity product. IDKit winners are not described in enough detail in the indexes opened here to say which credential each one used.

---

## 1inch — $7,000

Card text is the same shape as [Lisbon’s 1inch card](https://ethglobal.com/events/lisbon2026/prizes/1inch). Mumbai adds nothing in the qualification block beyond what Lisbon already required.

About: DEX aggregator since 2019; “most recent release, Aqua, reimagines how DEXes are designed.”

### What the card says

“Create a custom Aqua app that implements a sophisticated DeFi position.” SwapVM users “may modify SwapVM opcodes and define your own instructions.” Positions must be shown through **test scripts or a UI**. “Projects that utilize SwapVM will be scored higher during the final judging.”

Requirements:

- Official Aqua/SwapVM contracts. Redeploying a **modified** SwapVM is allowed.
- Onchain token transfers in the final demo. “Local forks are ok.”
- “Proper Git commit history (no single-commit entries on the final day).”

Repos on the card:

- https://github.com/1inch/swap-vm
- https://github.com/1inch/aqua
- TypeScript SDK: https://github.com/1inch/sdks/tree/master/typescript/aqua
- SwapVM whitepaper: https://github.com/1inch/swap-vm/blob/release/1.1/docs/whitepaper-swap-vm-1.0.pdf
- Aqua whitepaper: https://github.com/1inch/aqua/blob/main/docs/whitepaper-aqua-1.0.pdf

The whitepapers were not read for this brief.

### Prior outcomes

Lisbon from-scratch, Medalist and Outposts: **ArcBook** $2,500, **Votive** $1,500, **KSwap-VM** $1,000.

[ArcBook](https://ethglobal.com/showcase/arcbook-twp2a) describes an onchain order book where each maker position is a bounded pricing curve, official Aqua as the balance layer, a custom SwapVM instruction, settlement on **Base Sepolia**, a subgraph, and a public MCP. The showcase says tokens stay under maker ownership until fill.

[KSwap-VM](https://medalist.build/projects/ethglobal/kswap-vm-aix5n) is indexed as “a formal semantics for 1inch’s swap-vm, and formal verification for its modules.” The prize it won was still “Build an Aqua App,” whose card asks for a DeFi position. A verification tool placed third on that card.

Tokyo from-scratch, Medalist: **OddsFlow** $2,500, **Wamia** $1,500, **watermark** $1,000. Continuity: **VexiHakari** $1,500, **Takarabako** $500. Tensor Hack’s blurb for VexiHakari: “Options via 1inch Aqua, with tokens pulled at fill and a Uniswap v4 TWAP quote guard.” It also records a Uniswap continuity 1st place for the same project. Product detail beyond that blurb was not fetched.

Agora, described in the 1inch blog above: futarchy-style decision markets, Aqua `ship` so one balance can back many proposals, a custom SwapVM instruction (`AgoraComplement`) hooked through `_extruction`, live Sepolia Aqua core, Foundry tests against a fork. The blog says the butterfly settlement was specified and not yet deployed as of September 2026, and that the code is an unaudited proof of concept. Prize-split conflict with Outposts is in the conflicts section.

### Documented deployment fact from a winner, not from 1inch docs

ArcBook settled on Base Sepolia. Agora’s author says they deployed their own router because the Sepolia SwapVM router they found was an `AquaSwapVMRouter` whose opcode table had no limit-swap instructions. That is a builder’s report, not a 1inch status page.

---

## 0G — $15,000

Card: https://ethglobal.com/events/mumbai/prizes/0g

About, sponsor language: “trust layer for AI.” Private compute, encrypted storage, and an AI-native EVM L1. 0G Private Computer is described as one OpenAI-compatible API for 100+ models, with verified runs, privacy on demand, and proof of which model produced a result. Storage holds datasets, weights, and live state. 0G Chain settles model runs, payments, and ownership.

Every track: discretionary payout, public repo with README and setup, demo video under 3 minutes, live demo link, team names plus Telegram and X. Contract addresses “if any” on the Private Computer track, and required on the other three.

### Private Computer — $5,000

Consumer app “where AI on 0G is the product: something people open, use, and come back to tomorrow.” Image, video, and voice are explicitly welcome.

Models named on the card: image `seedream`, `hy-image`, `z-image`; video `seedance`, `minimax-h3`; speech `whisper-large-v3`; multimodal `qwen omni`, `qwen vision`; “0G native: `0gm-1.0`.”

Must show: inference on 0G Private Computer in the main user flow, **with request IDs**; a working app a judge can try; a sentence on what breaks if 0G is removed.

Stated non-goals: “Generic chat wrappers.” “Apps where the AI call could be removed without anyone noticing.”

iAI bonus, scored higher, not a separate purse: sign-in with a 0G account and spend that account’s daily credits. Card states iAI holders get 1.271 credits per staked iAI, refreshed 00:00 UTC, unused credits expire. “You don't need to buy or mint iAI. Test with the 0G credits we give your team.” Sign-in “only works on localhost:3000, 3001 or 5173.” The Privy app ID is something 0G says they will share. Standout apps “may be invited to discuss a revenue share” after the hackathon. That sentence is not a prize.

Links: https://0g.ai/blog/introducing-infinite-ai , https://iai.finance , https://iai.finance/docs , https://pc.0g.ai , https://docs.0g.ai/developer-hub/building-on-0g/compute-network/overview , https://iai.finance/docs#p-legal

### Physical AI — $5,000

A robot, drone, wearable, or pocket device whose **decisions** run on 0G. Simulated builds are eligible for every prize. One of the three purses is “Best build on real hardware” ($1,000). “0G is the brain, not the spinal cord: motion stays on the device, while 0G makes the decisions at key checkpoints.”

Named starting points: [zerobot](https://github.com/0gfoundation/zerobot) (card: open-source robot control SDK, mock robot, “currently targets the Unitree Go2 on 0G Galileo testnet”), or MuJoCo, PyBullet, Gazebo + ROS 2, or LeRobot. Personal-device lane mentions glasses, a pocket device, or a desktop companion, with memory on 0G Storage and sealed inference. The card cites Meta’s Muse assistant as the thing this lane is an alternative to.

Must show: a 0G call inside the decision loop (vision, voice, or decision model); an episode log on 0G Storage with a request id per decision; a replayable simulation or a live hardware demo at the 0G booth; a safe-stop if 0G is unreachable. “A fallback that fakes the decision disqualifies.”

Stated non-goals: “a chatbot with a robot avatar, pre-recorded motion, 0G used only for logs.”

Live: the zerobot GitHub URL returned HTTP 200. The repository contents were not reviewed.

### Keep Building — $3,000, continuity only

For a project started at a previous ETHGlobal, ETHGlobal Open Agents, Zero Cup, an AKINDO wave, or independent prior work. The card says polish on old demos is not the subject. It asks for new features, production hardening, user readiness, and a trajectory toward usage.

Must show: a link to prior state (dated commit or previous submission page); a dated changelog of work during the Mumbai window; a 0G Compute request id, a 0G Storage root hash, or a 0G Chain contract address from this hackathon; a “What’s next” statement.

Stated non-goals: “old demos re-presented as new work, cosmetic changes only.”

### Agents that pay for themselves — $2,000

“Most agents stop running the day their owner stops paying the API bill.” The agent should earn, and that money should pay for its own 0G Compute inference without a human topping it up.

Recommended path on the card: [comfy](https://www.comfy.fun/docs), described as a token launchpad on 0G. Steps written on the card: register with the comfy CLI (mints onchain identity); launch a token with the compute share on, so part of creator fees land as 0G compute credit; mint a capped compute key that the agent uses and that comfy does not hold. Other earning paths “count too” if the money reaches 0G Compute without a human in the loop.

What the card says it wants to see: a job worth paying for or trading on; a budget-aware agent that reads its balance and switches model, slows down, or pauses; agents that hire or pay other agents.

Stated non-goals: “A token launch with a chatbot attached.” “Revenue that only exists because the team trades its own token.” “An agent whose wallet a human refills.”

Must show: money in, credit landing in the agent’s 0G compute account, inference paid from that balance, with transaction hashes and request IDs; the agent running during the demo with no manual top-up; a spend cap and the low-funds behavior. If using comfy: agent ID, token address, and the token’s fees tab showing compute delivered.

Live: `comfy-cli` on npm was version **0.9.4** at probe time. Plugin linked from the card: https://github.com/0g-axion/comfy-plugin

### Technical facts checked

[Router quickstart](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/quickstart), fetched 5 November 2026:

- Connect a wallet at https://pc.0g.ai (MetaMask, WalletConnect, or Privy via Google, X, Discord, or TikTok).
- Deposit **0G tokens** to the router’s onchain payment contract. Balance is debited per request.
- Create an API key in Dashboard → API Keys. The secret starts with `sk-`. The page says the router never shows it again. It distinguishes `sk-` API keys from `mk-` management keys.
- Documented base URL in the quickstart: `https://router-api.0g.ai/v1`. Example model in the snippet: `glm-5.2`. The client shown is the OpenAI SDK with that base URL.
- [Chat completions](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/features/chat-completions): responses are OpenAI-shaped and **always** include `x_0g_trace`, with `request_id`, `provider`, and `billing.input_cost` / `output_cost` / `total_cost`. The sample `request_id` is a UUID. This is the field that matches the prize’s “request IDs,” as documented. It was not proven by sending a paid request.
- [Compute overview](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/overview): Router is described for server-side apps and agents. Direct mode uses `@0gfoundation/0g-compute-ts-sdk` and wallet-signed requests. The overview says to use Direct for browser dApps with wallet signing or onchain control, and that the Router is the other path.

A testnet router base URL was **not** on the three 0G pages extracted. `https://pc.0g.ai/models` returned HTTP 200; the model list body was not parsed. The prize’s named models and the quickstart’s example model (`glm-5.2`) are not the same list.

Faucet linked from the card: https://faucet.0g.ai . Not probed.

Lisbon recap by 0G, [0g.ai/blog/ethglobal-lisbon-2026-recap](https://0g.ai/blog/ethglobal-lisbon-2026-recap): the sponsor says 67 projects submitted to 0G, 57 of 67 had “meaningful” integration on repo review, and 9 teams were paid. Their table: Compute 82% (55), Storage 67% (45), Agentic ID (ERC-7857) 46% (31), 0G Chain “nearly half.” They say judging combined live demos with repo review. That is a sponsor’s account of Lisbon, under a different prize card (Best AI Product / Infrastructure / Keep Building). It is evidence they have withheld payment from submissions they judged non-integrating. It is not a measurement of the Mumbai card.

Lisbon winners in that post and on Medalist: 0run $3,000, Hands Unchained $2,000, KOLlateral $1,000 (product); AEGIS, Superpose, Lortnoc Tahc at $1,500 (tooling, equal); Happy Hour, Orloj Finance Agents, NpmGuard at $1,500 (continuity, equal).

[Hands Unchained](https://ethglobal.com/showcase/hands-unchained-6kdf3): humans teleoperate robots; a TEE-attested model on 0G Compute grades the episode before payment. The write-up says a grade with no attestation can still pay but cannot cost a strike, and that the backend can choose which graded attempt to submit. Chains named: 0G Galileo chain id 16602 and Hedera testnet chain id 296.

Cannes recap, [0g.ai/blog/ethglobal-cannes-recap](https://0g.ai/blog/ethglobal-cannes-recap): sponsor says a $5,000 track, 12 prototypes, 11 using Compute, 3 using Storage, and names AInfluencer (1st, YouTube content via 0G Compute) and PrivyCycle (2nd, period tracking with 0G Compute insights). Third place was not in the excerpt retrieved.

Mumbai’s “not wanted” lines (chat wrapper, removable AI, fake safe-stop, self-trading a token, human top-up) are stricter than the Lisbon product-track text retrieved, which asked for end-user applications on Compute without those bans.

---

## Uniswap Foundation — $15,000

Both tracks use the same scope sentence: build on or integrate any part of the Uniswap stack, including the **Uniswap API**, the AMM (**v2, v3, or v4**), **CCA**, “or any other Uniswap protocol.” Also “new v4 hooks, extensions or improvements to official Uniswap repositories, and tooling or solutions built for the broader ecosystem.”

There is no separate hook-only purse and no separate API-only purse on this card. Tokyo 2026 had split “Best Uniswap Stack Contribution” from-scratch and continuity. Lisbon 2026 had “Best Uniswap API Integration” ($7,000, five places) and a continuity stack prize. Mumbai folds API, AMM, CCA, hooks, and tooling into one from-scratch purse with four places, the largest single 1st place on this card at **$4,000**.

Qualification is the feedback-form requirement in the inventory table. Docs link on the card carries a campaign query string: `utm_campaign=20261104-ethglobal_mumbai`. Other links: https://developers.uniswap.org/dashboard/welcome and https://www.skills.sh/uniswap/uniswap-ai

### What the docs say is currently on the stack

From the Uniswap developer docs index fetched via `llms-full.txt` and the CCA pages:

- The Trading API is described as a hosted REST service that abstracts routing, gas estimation, Permit2 approvals, and transaction construction across v2, v3, v4, and UniswapX. The integrator handles wallet signing and onchain submission. The index does not say the API is keyless.
- CCA / Liquidity Launchpad: bidders submit a budget and a max price; tokens release over a block schedule; a uniform clearing price is recomputed; after graduation, proceeds can initialize a v4 pool through an `ILBPInitializer`. Technical doc: https://github.com/Uniswap/continuous-clearing-auction/blob/main/docs/TechnicalDocumentation.md . A Uniswap blog says auctions can be launched from the Uniswap web app and names Aztec and Cap as prior auction users. That blog was retrieved as a snippet, not a full audit of those auctions.
- `submitBid(maxPrice, amount, owner, prevTickPrice, hookData)` is the function documented for bidding. `maxPrice` must be strictly above the current clearing price.

CCA integrations were not identified among the Uniswap winners in the Lisbon, Tokyo, and Brussels showcases opened for this brief. That is an absence in those pages, not a statement that none exist.

### Prior outcomes

Tokyo from-scratch stack prize, Medalist: **Kura** $3,000, **Bailiff** $2,000, **OniBlock** $1,000. Continuity: **VexiHakari** $2,000, **XSwap** $1,000, **Reckn** $1,000. Tensor Hack also lists Reckn as a 3rd place; Medalist places Reckn on the continuity row. The two indexes disagree on which Tokyo purse Reckn won. Kura is also an ENS 3rd place in both indexes.

[OniBlock](https://ethglobal.com/showcase/oniblock-4hnma): a v4 hook on Sepolia against “the real v4 PoolManager.” Dynamic fee via `beforeSwap` and `OVERRIDE_FEE_FLAG`. An offchain model’s opinion is pushed onchain as a signed attestation because, in the team’s words, contracts cannot call the model. Stale oracle falls back to a conservative fee. JIT logic is described as a modification of OpenZeppelin’s `LiquidityPenaltyHook`. The hook path “never reverts.”

[Bailiff](https://tensorhack.com/winners/ethglobal), index blurb only: “Any keeper can liquidate restricted-RWA loans via Uniswap v4. The RWA never leaves the allowlist.”

[Kura](https://buildpodium.com/hackathons/ethglobal-tokyo2026), index blurb: vault physical cards, sell shards to verified humans, buy out 80% to take the card home. The Uniswap-specific contract design was not fetched.

Lisbon API prize, Medalist: KOLlateral $2,000, Sentinel $2,000, Peregrine $2,000, RWA Outlet $500, Umbra $500. The printed Lisbon structure was 1st $2,000, 2nd $2,000, 3rd $2,000, 4th $500, 5th $500, and Medalist’s place labels do not line up one-to-one with three distinct 1st places. Use the dollar amounts, not the place words.

Brussels, older: [Cook Some Hooks](https://ethglobal.com/showcase/cook-some-hooks-ehuy8) records Uniswap Foundation “Research and Experimentation, 2nd place,” plus PancakeSwap and Worldcoin pool prizes. The product is an LLM that generates, deploys, and verifies a v4 hook. No dollar amount is on the showcase excerpt.

The recent Uniswap showcases retrieved are hooks, liquidation, and API-routed trading. A plain swap widget is not what those pages describe.

---

## Arc — $15,000

About: “Circle’s purpose-built, EVM-compatible L1” and “the Economic OS for the internet.” Arc Studio: “Describe the onchain app you want, and Arc Studio works out what it needs in one place, including writing and testing any smart contracts, then builds the app around them.” It “has access to Arc and Circle products (USDC, EURC, Gateway, CCTP, Wallets) and other onchain skills,” and teams can bring skills. **Every Arc prize requires Arc Studio as the starting point.**

All five tracks share the same evaluation block:

- Built in Arc Studio. Shareable project URL. Show Studio in the demo.
- Working frontend and backend, plus an architecture diagram.
- Video and presentation covering core functions and use of Arc Studio and Circle’s tools, with documentation.
- GitHub or Replit link.
- State which bounty the submission is for.

No second or third place is printed. Each purse is a single $3,000 line.

### The five purses, in the card’s words

1. **DeFi / onchain finance, end to end in Arc Studio.** USDC or EURC settlement. Listed interests: trading, including tokenized RWAs; lending, borrowing, credit, collateral; payments and liquidity infrastructure (“for example, a credit co-op”); neobanks for consumers or businesses.
2. **Mobile web consumer agent using the Marketplace Discovery API.** The agent discovers services through the API and pays in USDC on Arc. “No crypto knowledge needed from the user.” Listed interests: the agent finds and selects services; per-use payments with Nanopayments; consumer controls (spend limits, approvals, history); mobile-first. Links: https://www.circle.com/blog/discover-the-whole-agent-marketplace-in-one-call and https://developers.circle.com/agent-stack/agent-marketplace/discovery-api . The docs URL returned HTTP 200. The API schema was not extracted.
3. **Advanced stablecoin logic, written in Arc Studio.** Conditional flows, onchain automation, or multi-step settlement, then a web or mobile app connected without leaving Studio. Listed interests: conditional escrow with onchain dispute and automatic release; programmable payroll or vesting in USDC or EURC; treasury splits; software-to-software payments; crosschain conditional transfer (“escrow on source, release on destination via Circle Forwarder”). “Bonus consideration” for contracts designed to be reused. Bonus consideration is not a separate amount.
4. **Bridge Kit for non-USDC assets.** CCTP via Bridge Kit. Listed interests: move non-USDC assets in one user flow; a tool that makes a new asset crosschain; flows that settle or pair with USDC or EURC on Arc. Link: https://developers.circle.com/cctp/expanded-assets
5. **Continuity: bring a project you already own onto Arc** by extending it or rebuilding it. Open source and live products both qualify. Listed interests: USDC or EURC payments on an existing commerce, fintech, or wallet product; crosschain transfers or unified balance in a product already in production; nanopayments in an existing agent or API monetization tool; stablecoin settlement or escrow on an existing DeFi protocol or marketplace; treasury or FX in a live multi-chain product.

Card links mix `http://arc.io`, `https://arc.io`, and the sponsor header `arc.network`. Studio URL printed: https://studio.arc.io . Live: that URL returned HTTP 200. What the studio actually generates was not tested.

### Chain facts from Circle docs, not from the prize card

[Arc network details](https://docs.arc.io/arc-chain): mainnet chain ID **5042**, testnet chain ID **5042002**, gas token USDC, deterministic sub-second finality, permissioned validators, permissionless developer access, EVM Osaka. [Circle’s USDC address table](https://developers.circle.com/stablecoins/usdc-contract-addresses) lists Arc mainnet USDC at `0x3600000000000000000000000000000000000000`. The table excerpt retrieved did not include a testnet Arc address. Decimals for that Arc address were not in the excerpt.

Definitive’s Flash chain table includes Arc mainnet chain ID 5042 with RPC `https://rpc.drpc.mainnet.arc.io`. That is a third party listing Arc as a trading venue, not an Arc status page.

### Prior outcome retrieved

[Mars](https://ethglobal.com/showcase/mars-ua1qc) (New York 2026) records “Arc - Best Agentic Economy with Circle Agent Stack, 1st place,” and also a Hedera agentic-payments prize. The write-up escrows USDC on Arc between a requester agent and an auditor agent. New York’s Arc card had several tracks (agentic economy, chain-abstracted USDC, advanced stablecoin logic, prediction markets, private nanopayments, continuity). Mumbai’s five tracks overlap that list in theme and add Discovery API, Bridge Kit for non-USDC, and a hard Arc Studio requirement that was not verified against the New York card text.

---

## Hedera — $15,000

Header about-text calls Hedera “a leading EVM blockchain” and points at Solidity **or** the JavaScript SDK, plus Java, Python, Rust, Go, and Swift. The no-Solidity track forbids smart contracts. Both statements are on the same partner header.

Docs agent note, fetched with the facilitator page: do not call Hedera a blockchain in Hedera’s own documentation; it is a public proof-of-stake hashgraph. JavaScript imports should come from `@hiero-ledger/sdk`, not `@hashgraph/sdk`. The Mumbai no-Solidity card says “Hedera JavaScript/TypeScript SDK or Python SDK” and does not name the npm package. New York 2026’s no-Solidity prize text, preserved on Medalist, still said `@hashgraph/sdk`. Package naming has moved between that event and the current docs.

### x402 — $6,500

Card summary of the standard: HTTP 402, server quotes a price, client pays inside the request, “no checkout page, signup, or API key.” On Hedera, settlement is HBAR or HTS tokens including USDC. “The facilitator pays the network fee, so the paying agent doesn't need to hold HBAR for gas.”

Ideas printed on the card, as ideas not requirements: pay-per-call inference or data; an agent marketplace; a metered MCP server; a research agent that compares prices of paid sources and reports spend; micropaywalls; an open-source Hedera facilitator with safety checks and replay protection.

Qualification:

- At least one x402-protected endpoint settling on testnet or mainnet through a listed facilitator or one the team runs.
- An agent or client that finds the endpoint and completes at least one paid request with **no human approving**.
- Public repo. README covers setup, architecture, payment flow, and the **Hedera transaction ID** of at least one settled payment.
- Demo video ≤ 5 minutes showing a payment settling and a HashScan link.

“Extra points” printed, not required: spending controls (budgets, per-merchant limits, allowlists, human approval above an amount); HCS-14 or ERC-8004 identity; an HCS topic as a spending audit log; multi-agent negotiation (A2A or ACP) before payment; settlement in an HTS token such as USDC, or HTS custom fees to split revenue; recurring payments through Scheduled Transactions; Hedera Agent Kit or the hosted Network MCP.

Docs linked:

- https://docs.hedera.com/solutions/ai/x402
- https://docs.hedera.com/solutions/ai/x402/how-it-works
- https://docs.hedera.com/solutions/ai/x402/pay-with-x402
- https://docs.hedera.com/solutions/ai/x402/merchant-integration
- https://docs.hedera.com/solutions/ai/x402/facilitators
- https://docs.hedera.com/solutions/ai/x402/exact-scheme
- https://github.com/x402-foundation/x402
- https://hedera.com/blog/hedera-and-the-x402-payment-standard/
- Agent Kit: https://docs.hedera.com/solutions/ai/agent-kit
- Network MCP: https://docs.hedera.com/solutions/ai/hosted-mcp-server
- Scaffold HBAR: https://docs.hedera.com/solutions/tools/scaffold-hbar

Exact scheme, from the docs page: x402 version 2; networks `hedera:mainnet` and `hedera:testnet`; asset `0.0.0` for HBAR in tinybars, or an HTS token id in smallest units; facilitator is `feePayer` on a partially signed `TransferTransaction` (not `ScheduleCreate`). The spec requires the facilitator to check that the fee payer is never a net sender of value, that transfers balance, that `payTo` is credited the exact amount, and that the transaction is not a replay.

`@x402/hedera` on npm: version **2.30.0**, published **2026-11-04T20:08:33.929Z**. `@x402/core` and `@x402/next` were also **2.30.0**. The readme says alias handling defaults to `reject`, and that both payer and recipient must be associated with an HTS token or settlement fails with `TOKEN_NOT_ASSOCIATED_TO_ACCOUNT`. The readme’s association snippet imports `AccountId`, `Client`, `PrivateKey`, `TokenAssociateTransaction`, and `TokenId` from `@x402/hedera` itself. It points testnet account creation at https://portal.hedera.com/ and testnet USDC at Circle’s faucet with token `0.0.429274`.

Live facilitator advertisements on 5 November 2026:

| Facilitator | URL probed | Network in `/supported` | Scheme | Fee payer |
| --- | --- | --- | --- | --- |
| Official x402 | `https://x402.org/facilitator/supported` | `hedera:testnet` only, among other chains | exact, x402Version 2 | `0.0.9185802` |
| Launa testnet | `https://testnet.facilitator.launa.dev/supported` | `hedera:testnet` | exact v2 | `0.0.9839454` |
| Blocky402 testnet | `https://api.testnet.blocky402.com/supported` | `hedera:testnet` | exact v2 | `0.0.7162784` |
| Blocky402 mainnet | `https://api.blocky402.com/supported` | `hedera:mainnet` | exact v2 | `0.0.10571514` |

Official `/supported` did not advertise `hedera:mainnet`. Docs say Launa mainnet is a per-account URL with advertised fee payer `0.0.10789914`. That URL was not probed. Docs say the official facilitator needs no API key. Blocky402’s own site says hosted testnet includes Hedera testnet and hosted mainnet advertises Hedera mainnet, and that the code is MIT and self-hostable. Their marketing page still describes the client retry header as `X-PAYMENT` in one section; the current x402 v2 header names were not re-derived from the spec in this pass.

Mirror node, live:

- `https://testnet.mirrornode.hedera.com/api/v1/network/supply` returned HTTP 200.
- Token `0.0.429274`: name `USD Coin`, symbol `USDC`, decimals `6`, type `FUNGIBLE_COMMON`, `total_supply` `10000000005000000`.
- Mainnet token `0.0.456858`: name `USD Coin`, symbol `USDC`, decimals `6`, type `FUNGIBLE_COMMON`. Circle’s address table lists Hedera mainnet USDC as `0.0.456858`.

A Hedera-published bounty, not an ETHGlobal prize, [31 August 2026](https://hedera.com/blog/x402-bounty-on-hedera-winners-announced/): five builders received $1,000 each. The post’s descriptions:

- **Pinout** (https://github.com/hitakshiA/pinout , https://pinout.club/): one payment opens a metered session, per-second or per-token burn, refund of the remainder, HCS checkpoints plus a HIP-991 topic. No smart contract. GPU rental by the second.
- **Tally** (https://github.com/Madhav-Gupta-28/Tally , https://hedera-tally.vercel.app/): `upto` scheme, one offchain spending ceiling, settle the metered amount, HTS allowance, a contract at `0.0.9556979` on testnet. This one does use a contract. The post says the scheme was submitted upstream.
- **Xorv** (https://github.com/nickthelegend/xorv): marketplace for unused AI-subscription quota, USDC over x402, HTS plus HCS, no contract.
- **Qisma**: one `CryptoTransfer` pays an aggregator and three upstreams at one consensus timestamp. The blog excerpt cuts the repo URL.

These four are prior art for “API becomes a paid Hedera request,” including metering, `upto`, and multi-party split. They are not ETHGlobal winners.

### Tokenize with Studios — $5,000

Asset Tokenization Studio for security tokens, bonds, and equities, with ERC-3643 and ERC-1400 named. Stablecoin Studio for minting and managing fiat-backed stablecoins with admin and reserve controls. “Pick something that exists today in finance, trade, or commerce.”

Qualification: use ATS or Stablecoin Studio (SDK, contracts, web app, or a combination); testnet; public repo; contracts verified on HashScan where applicable; video ≤ 5 minutes covering issuance, configuration, and at least one lifecycle operation (coupon, redemption, freeze, or reserve update are the examples).

Extra points: KYC, freezes, transfer restrictions, pauses; custom fees and distributions; oracle or NAV; Scheduled Transactions; contributions back to the studios.

Docs: https://docs.hedera.com/solutions/tokenization/ats and https://docs.hedera.com/solutions/tokenization/stablecoin . Bodies not extracted.

### No Solidity — $2,000

“Build a complete app on Hedera without writing a single smart contract.” Native services named: HTS, HCS, scheduled transactions, multi-signature transactions, accounts. At least **two** native services. Public repo, video ≤ 5 minutes.

Extra points: end-to-end UX; Mirror Node REST API; creative HCS use; Agent Kit; key management and access control.

The x402 card’s own examples include a facilitator and a USDC settlement that the `@x402/hedera` readme implements without the app author writing Solidity. Whether that satisfies “two native services” depends on which services the app actually calls. The card does not answer that.

### Continuity — $1,500

“Polish and bug fixes alone don't qualify.” The project must already exist on Hedera, from a previous hackathon or otherwise. New work must be a feature, a new Hedera service, or a major architectural change. README should separate old and new. Video focuses on the new work.

### Prior ETHGlobal outcomes

New York 2026, Medalist, pool $15,000, 11 prizes recorded:

- Agentic payments, **$2,000 × 3**: Accrue, Kickoff Aivy Studio, Mars. Not a 1st/2nd/3rd ladder.
- No Solidity, **$1,000 × 3**: Dead Men Tell Tales, Proof of Plate, ZoneProof.
- Continuity automation, **$1,000 × 3**: AgentRanker, Azimuth, YourTurn Concierge.
- Tokenization, **$1,500 × 2**: cashmeifyoucan, Wafer.

[Accrue](https://ethglobal.com/showcase/accrue-racfy): ads inside AI wait spinners, USDC escrow, World ID to bind an earning agent to a person, Solidity contracts paying HTS-USDC. The write-up says HTS-USDC is not a standard ERC-20 and routes through the `0x167` precompile, and that accounts must `associateToken`.

[Mars](https://ethglobal.com/showcase/mars-ua1qc): skill marketplace. Hedera side is HCS topics (the write-up names HCS-1, HCS-2, HCS-16, HCS-18, HCS-25, HCS-26) for audit, registry, and negotiation. Payment escrow is described on Arc, not as an x402 Hedera settlement.

Lisbon 2026, Medalist:

- Agentic payments, **$3,000 × 2** out of a $6,000 line: [Glassbox402](https://ethglobal.com/showcase/glassbox402-qyepd) and Vouch. A LinkedIn post by a Vouch builder calls it first place. The index shows two equal $3,000 awards, not a $3,000/$2,000/$1,000 ladder.
- No Solidity, **$1,000 × 4**: AgentRouter, MilFi, Ognef, Pastel.
- Tokenization, **$1,500 × 2**: Mint & Chill, Nook.
- Other small Hedera lines: F2F Cross-Border $1,000 (existing), Alba $1,000.

Glassbox402 also records a $1,000 Lisbon finalist prize on Medalist. The showcase describes an npm wrapper that turns an existing API into x402, settlement through Blocky402, no private key on the resource server, an HCS receipt per payment, and a judge connecting MetaMask so the first payment lazy-creates a Hedera account. Multi-chain flags for Hedera, Base, and Solana are part of the product description.

Vouch, from the builder’s LinkedIn only: “sensor-quality verification layer for DePIN rewards,” first place on the Lisbon agentic-payments track. The showcase was not fetched.

Cannes: PolyAgents, with the simulation caveat above. The team post says the agent pays for LLM calls in HBAR and logs decisions to HCS.

Pattern across the retrieved winners: the agentic-payments purse has paid API monetization (Glassbox402), a labor/attention market (Accrue), an audit marketplace whose money moved on Arc (Mars), and a trading agent whose demo path simulated the Hedera calls (PolyAgents). No-Solidity has paid four and three teams at $1,000 in the two events indexed, which means that purse has been split evenly rather than ranked. Descriptions of those no-Solidity apps were not fetched.

---

## Arkiv — $15,000

About: “the Web3 database, an Ethereum-aligned DB-Chain.” Data lives in entities. Each entity is owned by a wallet, can be queried with SQL-like filters, and expires when the writer chooses.

Network block printed on the card, and confirmed against [Rabdi docs](https://docs.arkiv.network/networks/rabdi/):

| Field | Value |
| --- | --- |
| Chain ID | `7794095` (`0x76edaf`) |
| HTTP RPC | `https://rpc.rabdi.db-chain.testnet.arkiv.network` |
| Explorer | `https://rabdi.explorer.arkiv.network` |
| Indexer | `https://indexer.rabdi.db-chain.testnet.arkiv.network` |
| Faucet | `https://hub.arkiv.network/faucet` |
| Access keys | `https://hub.arkiv.network/access-keys` |
| Native gas token | tGLM (docs) |
| Block time | 2 seconds (docs) |
| SDK | `@arkiv-network/sdk`, npm **1.0.1** at probe time |

Live `eth_chainId` on that RPC returned `0x76edaf`, which is 7794095. Docs say the public RPC is heavily rate limited and that an access key should be passed into `rabdi({ accessKey })`. An empty access key still selects the public RPC and logs a warning.

Judging on the app tracks is four written files, 25% each: friction, reach, why Arkiv, and either data quality (mirror) or how you use Arkiv (apps). Node tooling replaces reach / why / how with real use, what’s new, and easy to run. “Not counted: the SDK installed but never used to read, or Arkiv used only as a log that nothing reads.”

Example the card itself ships: Sourcify’s verified-contract set mirrored at https://sourcify.arkiv.network . That URL returned HTTP 200. The mirror track then **forbids** using Sourcify data from any chain. Other data ideas named: token lists, chain and RPC registries, address labels, wallet ratings, function signatures.

App-track directions named: ephemeral agent coordination (tasks, bids, claims); listings or offers that expire; posts, profiles, follows; ENS-keyed profiles or service directories.

Node tooling: a collector beside a node (disk-days remaining, latency per method, peers, sync, CPU, memory) or a slow-query finder. “Run it only on your own node, never on a public endpoint.” Reference UI: https://nodes.arkiv.network . Client: https://github.com/Arkiv-Network/arkiv . “A pull request to an existing repo is not from scratch.” Slow query shapes go to Arkiv privately, not into the public repo, `friction.md`, or the demo. “A node on your own machine is enough.”

Swarm bonus: files on Swarm, reference from an Arkiv entity. The card warns that an encrypted Swarm reference contains its key and Arkiv entities are public, so the reference must be encrypted first or kept off Arkiv. Required in `/arkiv/swarm.md`: what sits where, one entity key plus a Swarm reference a judge can open, postage batch ID, wallet that bought the batch, Bee node or service, the upload and read code, reproduce steps, the moment in the demo video, and what went wrong. Docs: https://docs.ethswarm.org

AI tools linked but not tested: https://hub.arkiv.network/ai-tools

No Arkiv winner was identified in the Lisbon, Tokyo, or New York 2026 Medalist sponsor lists consulted. Arkiv’s “why Arkiv” criterion asks the team to say what a user loses if the data sits in Postgres instead. That question is the sponsor’s judging prompt.

---

## Whitechain — $15,000

About: “The Onchain Economy Layer,” an EVM L2 on the OP Stack, “with mainnet arriving in November,” at this event together with Optimism. The prize requirements are **testnet**, not mainnet. Whether mainnet had launched by 5 November 2026 was not checked beyond that sentence.

Chain ID on every track: **1874** (Whitechain Sepolia). Contracts must be deployed there and **verified** on the Whitechain explorer. At least one payment in USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` in the main flow, with the explorer link in the README. A test token the team mints does not count. README must say why the flow needs onchain stablecoin settlement on Whitechain and what a regular payment rail could not do. Commit history must show progress through the hackathon rather than one upload at the end. Video 2–4 minutes showing each party. `WHITECHAIN_FEEDBACK.md` required.

Free RPC offer on the card: Ankr, 1,500 requests per second for 7 days, https://www.ankr.com/rpc/?utm_referral=Whitechain2026 . Not activated in this research.

Links: https://docs.whitechain.io (HTTP 308 on the bare URL), faucet https://faucet.testnet.whitechain.io , explorer https://explorer.testnet.whitechain.io , builders program https://whitechain.io/builders , YetiTrade testnet https://testnet.yetitrade.fi . Faucet behavior (drip size, GitHub OAuth, age of account) was **not** re-read from the docs in this pass. Do not treat a secondhand faucet description as verified here.

### Operate — $5,000

“Give a business everything it needs to get paid in USDT,” from first checkout through what happens after. Ideas named: drop-in checkout with webhooks and an onchain receipt; payment links and invoices with due dates; subscriptions with permit-based pulls; refunds and partial refunds.

“What we want to see”: a drop-in piece a separate demo app adds in about 20 lines; both merchant and payer in the demo; extra credit for a refund, a renewal, or an accountant export.

“Won't place”: a pay button that sends a plain transfer, tipping jars, bill splitters, or custodial bridges into a local-currency token. “Payroll, escrow and revenue splits on their own.”

### Tokenize — $4,000

RWA lifecycle and compliance. Every payment in USDT. Ideas named: bonds or notes with an allowlist, coupons, and maturity; invoice financing (distinct from paying an invoice); repo or DvP; trade finance with importer, exporter, and bank.

“What we want to see”: transfer rules in the contract (allowlists, restrictions, maturity, settlement conditions). “A token with a UI on top” is explicitly not enough. A clear issuer or investor, and at least one full lifecycle step.

“Won't place”: a token with a mint button and no rules, or ownership NFTs where nothing is enforced onchain.

Boundary written on the card: “Paying an invoice belongs in Operate. Financing or selling an invoice belongs in Tokenize.”

### Scale — $3,000

“The payer, a person or an AI agent, pays in stablecoins without holding WBT for gas, writing down a seed phrase or knowing what chain they are on.” Ideas named: gasless checkout where the merchant covers gas, using permit or EIP-3009 `transferWithAuthorization` and the team’s own relayer; embedded wallet or smart account that supports chain ID 1874; pay-per-request APIs where an agent pays USDT over x402 through a facilitator the team runs.

“What we want to see”: zero crypto steps visible to the payer; how the business pays for gas; how the relayer gets WBT; what stops someone draining the relayer.

“Won't place”: flows where the payer still signs a transaction that costs them gas, or “AI chats that never actually pay anyone.”

### Continuity — $3,000

Add Whitechain to a product that already has users, or to an open-source repo. “A nicer UI on what you already had is not enough.” “Real users or a real business behind the product count in your favour.” Proof of the starting point is required. Two equal $1,500 places.

No Whitechain winner was identified in the 2026 Medalist indexes consulted. The sponsor is presenting with Optimism; the card links OP Stack docs but the qualification block does not require an Optimism-specific contract pattern beyond being an OP-stack EVM chain.

---

## Ethereum Foundation — $15,000

About: the Access Layer team, CROPS (censorship resistant, open source, private, secure). Two tools at this event: **Anon-RPC** and the **alternative mempool** for EIP-8141 frame transactions. “Build with either, or build any app where one CROPS property is the reason it exists.”

Mandate link on the card: https://blog.ethereum.org/2026/03/13/ef-mandate . The blog body was not fetched. The card’s own CROPS definition is the one used below.

### Anon-RPC — $5,000

Use it as a consuming app, produce anonymity with a new worker, or fork the harness onto a new platform. Ideas named: portfolio dashboard, block explorer, fork of an existing dApp, a playground that measures anon-rpc against several networks, combining it with a light client or proof verification, a new network, a new harness.

Judging criteria printed: works end to end; UX; how much of the app’s traffic goes through Anon-RPC; an intentional exclusion of some traffic for a performance/anonymity tradeoff is acceptable if explained; whether it could ship after the hackathon; technical depth.

Qualification: the app routes RPC reads through Anon-RPC by default. A worker or harness may ship with a simple demo app.

Links: https://ethereum.github.io/anon-rpc/ (HTTP 200), wallet guide https://ethereum.github.io/anon-rpc/wallets/ , networks guide https://ethereum.github.io/anon-rpc/networks/ , repo https://github.com/ethereum/anon-rpc , npm `@anon-rpc/browser-harness` version **0.4.0**, and `@anon-rpc/browser-extension-harness` (version not probed).

### Alt mempool — $5,000

EIP-8141: the account’s code decides validity. “The public mempool only accepts the simple ones.” ERC-8421 is the alternative mempool, with ERC-7562-style staking and reputation. Three areas named:

- Applications that need verification budget above 100k gas (examples: post-quantum smart wallets, post-quantum privacy protocols) or more flexible state access in the sender or paymaster (examples: ERC-20 paymasters, daily-quota paymasters).
- Tooling: a viem/ethers SDK, an admission simulator, mempool monitoring.
- Breaking the rules: DoS, vulnerabilities, new rules, simulators, fuzzers.

Judging criteria printed: creativity, usefulness, practicality, how well it works, relation to the alt mempool.

“Multiple devnets will run during the hackathon with keyed nonces and recent roots live, plus a faucet.” Named people on site: Pierre and Alex.

Qualification: a link to an admitted transaction on the devnet explorer, or code that submits one. The team must be able to explain design, code, and trade-offs.

Links: https://github.com/forshtat/mempool-workshop-sidecar , https://github.com/forshtat/ethrex/tree/eip8141-tracer , explorer https://explorer.altmempool.wtf/ , devnet guide https://docs.altmempool.wtf/guides/devnet/ , docs https://docs.altmempool.wtf/ (HTTP 200), starter https://github.com/forshtat/mempool-workshop , https://www.altmempool.wtf/ , EIP-8141 https://eips.ethereum.org/EIPS/eip-8141 , ERC-7562 https://eips.ethereum.org/EIPS/eip-7562 .

The devnet’s uptime during the hackathon is a statement on the card. It was not probed.

### CROPS app — $3,500, and continuity upgrade — $1,500

Lead property has to be the reason the app exists, “without giving up the other three.” “Structural (works without you) beats cosmetic (a setting).” EF tooling is optional; Anon-RPC and the alt mempool have their own purses.

Ideas named: a wallet recoverable with nothing from the team (no server, API, or relayer); a frontend that still works when its domain, backend, or RPC provider disappears; a payment, messaging, or social app whose server learns nothing about who talks to whom; a tool that shows what an app leaks; a tool that proves the shipped frontend matches the public repo.

README `CROPS` section, one or two lines each:

- C: what the team controls that the user depends on, and what happens if it goes away or refuses them.
- O: the license, and whether a user can build and run it from the repo alone.
- P: what each third party learns about the user.
- S: how keys and user data are protected, and the trust assumptions.

Demo ≤ 3 minutes must include the moment the lead property matters. Examples on the card: switch off the backend, swap the RPC provider, or show server logs with nothing identifying. No third-party trackers or analytics in the client. Keys and personal data stay on the device, or the README says why not. Continuity adds a before/after and judges only the new work.

Other links: Scaffold-ETH 2, Kohaku https://github.com/ethereum/kohaku , Walletbeat https://walletbeat.eth.limo . Not reviewed.

Anon-RPC and the alt mempool do not appear as sponsors on the Lisbon, Tokyo, or New York 2026 Medalist pages consulted. There is no prior ETHGlobal winner list for these two tools in the indexes used here. CROPS as a named prize is tied, on this card, to the March 2026 mandate post.

---

## ENS — $10,000

About: names as a universal pointer. The card says that as agents become onchain actors, ENS is how they get a name, a reputation, and a place to be found.

### Best Use of ENSv2 — $7,000

“ENSv2 is now live on Ethereum mainnet. Be among the first to build on it.” Features named:

- Hierarchical registries.
- Resolve subnames off a parent’s resolver with wildcard resolution, **or** deploy your own subname registry.
- Enhanced Access Control: role-based permissions on registries and resolvers. Example given: an account that can edit only certain text records.
- A Permissioned Resolver so a subname owns its data.
- Record aliasing at the resolver, or namespace aliasing via a shared registry.
- Combinations: expiring, revocable, non-transferable versus transferable, “forever names with no parent control.”
- “Bonus points if you bring AI agents into the mix. Think agents as namespaces, each with their own identity and permissions.” Bonus points are not a separate purse.

The payout line prints **two** “3rd place $1,000” rows. Tokyo’s ENSv2 results also had two $1,000 thirds. That is a pattern match, not a rule that Mumbai must place two thirds.

Qualification: ENSv2 on **mainnet or Sepolia**. Features “central to the product, not a cosmetic add-on.” Demo functional, not hard-coded values. Live demo link. Open source on GitHub or similar.

Docs: https://docs.ens.domains/ensv2/permissioned-registry , permissioned resolver, enhanced access control, contract-developer tutorial, app-developer tutorial, overview, https://github.com/ensdomains/ens-cli , ENSIP-26 agent text records, building-with-AI, ENSIP-25 agent registry verification.

The deployment conflict is in the conflicts section. The deployments page does list mainnet addresses for `ETHRegistry`, `RootRegistry`, `UniversalResolverV2`, `PermissionedResolverImpl`, `UserRegistryImpl`, `VerifiableFactory`, and others. Those addresses were visible even in the paragraph that still says resolution continues through ENSv1 until launch completes. Copying them into this brief without a full table would invite a stale address. Use the deployments page on the day of integration. The app-developer tutorial says not to hardcode a Universal Resolver address; libraries should use the canonical proxy `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe`.

### Continuity integration — $3,000

ENSv2 on **mainnet** specifically (the sentence does not mention Sepolia, unlike the from-scratch track). Integrate into an existing protocol or project, “yours or an open one.” Must be clear how ENSv2 improves it.

### Prior outcomes

Tokyo, Medalist and [Outposts](https://outposts.io/project/ethereum-name-service/article/ens-awards-six-ensv2-prizes-at-ethglobal-tokyo-cmuo4rl6f000i04jyetvzeq17), 30 September 2026:

- Best Use of ENSv2: Relay $3,000, ENS Drive $2,000, Tide $1,000, Kura $1,000.
- Continuity integration: Radius $2,000, Lortnoc Tahc $1,000.

Outposts’ descriptions: Relay delegates API access across teams and agents via ENS-named identities; ENS Drive lets a team manage a branch of names; Tide uses names and records for liquidity strategies; Kura attaches names to physical cards; Radius uses subnames as credentials for network and API access; Lortnoc Tahc uses subnames to control who can read encrypted conversations inside public posts. Relay’s own showcase contradicts the “ENSv2 contracts” reading; see conflicts.

New York 2026 was a different ENS card (Medalist): a $20,000 pool with separate purses for AI-agent integration (Aegis $2,500, AgentIndex $1,500) and “Most Creative Use of ENS” (ENS Subname Manager $2,500, Aragorn $1,500). The creative-use qualification there included an in-person Sunday booth presentation. Mumbai’s details page says booths are optional. Different event rules.

[ENS Subname Manager](https://ethglobal.com/showcase/ens-subname-manager-pj6re): email login, silent wallet, claim `alice.myclub.eth`, eligibility by email domain, ENSv2 Permissioned Registry on **Sepolia**, `ROLE_REGISTRAR` per resource, VerifiableFactory, revoke onchain. The write-up says a CCIP-Read gateway is designed as a future offchain path and that the onchain path is what is implemented. A LinkedIn post by a builder matches the $2,500 “Most Creative Use of ENS” result.

Cannes: VEIL VPN records an ENS “Most Creative Use” 1st place alongside World ID 4.0. Details of the ENS integration were not on the excerpt.

The public winning shapes already described in primary or sponsor recaps are: org subnames with issuance and revoke, API permission trees named with ENS, subnames as access credentials, names on physical collectibles, and names on liquidity strategy records. Cosmetic resolution is what both the Mumbai card and the New York creative-use card say is not the point.

---

## Definitive — $5,000

About, sponsor claims on the card, not independently audited here: professional execution for any ERC-20 or SPL asset; web, mobile, and API; “$3B+ notional spot volume” over millions of transactions; 900+ liquidity sources; 12 EVM chains and Solana. Order types named: DCA, Limit, Stop Loss, Take Profit, Cross-Chain, Bracket, Market. Newest release: **Flash API**, a REST API and MCP server “built for both human builders and AI agents.”

### Social app — $2,500, from scratch

“Trading is more fun, and stickier, when it's not a solo activity.” Examples the card encourages: copy trading using Flash; signals or leaderboards to X, TikTok, and other channels; agent-run products other users follow; “your own take.”

Tips printed on the card:

- Non-custodial. Works with an EOA or an embedded wallet (Privy, Dynamic, or Coinbase embedded wallets are named).
- Every listed order type goes through the same orders endpoint. Flash lands the trade.
- A fee can be attached to trades routed through Flash.
- MCP server and “LLM-optimized docs.”

Qualification: a working flow powered by Flash API or Flash MCP advanced orders (DCA, Limit, Stop, Stop Loss, Take Profit, TWAP). Onchain execution in the final demo. A short video on **both Discord and X**, tagging `@DefinitiveFi`.

### Creative use — $2,500, continuity only

“Somewhere unexpected”: a bigger agent workflow, another protocol’s tools, or a strategy. Examples: multi-agent systems where Flash is one tool, voice or chat interfaces, workflows that combine Flash with other MCP servers or onchain data. Judging words: originality, technical creativity, and how well the demo shows what Flash can do. Same three qualification bullets.

Docs, all HTTP-checked only for the docs root (200):

- https://flash.definitive.fi/docs
- https://flash.definitive.fi/docs/getting-started (API key)
- https://flash.definitive.fi/docs/for-agents
- https://flash.definitive.fi/docs/flash-mcp
- https://flash.definitive.fi/docs/placing-orders
- Quote and order API reference URLs are on the card.
- Monetize: https://flash.definitive.fi/docs/monetizing-your-integration (linked from the continuity track only).

[Supported chains](https://flash.definitive.fi/docs/supported-chains), fetched as a table: Arbitrum 42161, Arc 5042, Avalanche 43114, Base 8453, BSC 56, Ethereum 1, HyperEVM 999, Ink 57073, Monad 143, Optimism 10, Plasma 9745, Polygon 137, Robinhood 4663, Solana. The page says crosschain orders are live between supported chains when a route is available. Hedera, Whitechain, and Arkiv are not in that table.

No Definitive winner was identified in the Lisbon, Tokyo, or New York indexes consulted. The social track is the from-scratch purse. The creative track is continuity-only. An API key is on the getting-started path the card links. Whether a judge can obtain a key without the team is not stated.

---

## Chainlink — $5,000

About line on the card is the standard oracle-network sentence. Two purses.

### CRE — $1,500

Chainlink Runtime Environment is described as an orchestration layer for “institutional-grade smart contracts” that are data-connected, compliance-ready, privacy-preserving, and interoperable, connecting chains to APIs, enterprise systems, data sources, LLMs, or agents.

Qualification: build, **simulate, or deploy** a CRE workflow used as an orchestration layer inside the project. “It is NOT mandatory to deploy it during the hackathon, simulation is enough.” The workflow must integrate at least one chain with an external API, system, data source, LLM, or agent, and be “meaningfully used.”

Docs: https://docs.chain.link/cre . Templates: https://github.com/smartcontractkit/cre-templates/ . A YouTube playlist is linked. New York 2026’s CRE card added a sentence Mumbai’s card does not: if a team shows a successful simulation, “our team will deploy it to the live CRE network for you.” Do not assume that offer exists at Mumbai unless it is found elsewhere.

### CCIP 2.0 — $3,500

Two teams, $1,750 each. Use cases named: cross-chain DeFi, a yield aggregator, a token bridge, a multihop router “from blockchain A to blockchain B without worrying if the lane between them exists.”

“Use our CCIP Local Simulator” on Hardhat, Foundry, or Remix, then a faucet for testnet. The simulator and faucet URLs are not printed in the Mumbai `prizes.txt` body; the card says they are “at the bottom in the Resources section,” and that section in the file ends at the workshop line. The docs home is https://docs.chain.link/ccip (HTTP 200).

Qualification: CCIP must make a **state change** on a chain. “A front end simply reading from Chainlink Data Feeds doesn't count.” Using CCIP inside smart contracts is required. CRE, Data Feeds, Data Streams, and VRF are “encouraged,” not required.

The docs index shows CCIP token transfers, arbitrary messaging, programmable token transfers, a Cross-Chain Token standard, V1→V2 pool migration, and Cross-Chain Verifiers. Rate limits, manual execution, and fee/billing pages are in the nav. Latency and finality are chain-specific; no single latency number was extracted.

### Prior outcomes

New York 2026 Chainlink card was $14,000 and had CRE ($2,000 × 3), a general “connect the world” prize that still required a state change, Confidential AI Attester, and a continuity upgrade. It told builders to use CRE **instead of** Chainlink Functions or Automation, which “will be deprecated.” Mumbai’s card does not repeat the deprecation sentence. It also does not offer the general feeds/VRF purse. The only non-CRE purse at Mumbai is CCIP.

New York 2025 card: “Best usage of Chainlink CCIP and/or CCT,” up to 2 teams, $2,000 each, plus a $6,000 general Chainlink purse. [AnyPay](https://ethglobal.com/showcase/anypay-t4xox) records that CCIP/CCT prize. The write-up deploys a programmable token transfer splitter on Ethereum Sepolia, Arbitrum Sepolia, and Base Sepolia, with a stated destination gas limit of 500,000, and converts received CCIP-BnM to USDC. A LinkedIn post the same month claims a CCIP-track win for “DeFi Guardians” (premiums in PYUSD, governance on Hedera, CCIP between them). The prize allowed two teams. AnyPay is on a showcase winner field. DeFi Guardians was not opened on ETHGlobal.

[OpenCompliance](https://ethglobal.com/showcase/opencompliance-b89x9) (Cannes 2026) describes four CRE workflows and contracts on Arc testnet. The retrieved page’s winner field does not name the prize. It is evidence CRE was being used as an onchain compliance orchestrator before Mumbai, not evidence of a payout.

---

## Cross-event observations

These are descriptions of what the retrieved cards and winner pages contain. They are not a ranking.

- **Equal splits versus ladders.** The same sponsor changes the shape between events. Hedera agentic payments was $3,000 × 2 at Lisbon, $2,000 × 3 at New York, and a $3,000/$2,000/$1,500 ladder at Mumbai. World’s Tokyo agent prize was $2,500 × 3. Mumbai’s from-scratch Agent Pass prize is a ladder. 0G Lisbon tooling and continuity purses were equal splits. Mumbai’s Private Computer and Physical AI purses are ladders, and both say places may go unawarded.
- **Integration depth the sponsor can check.** 0G’s Lisbon recap says they opened repos. Uniswap requires a feedback form and line-level README pointers. Arkiv requires re-runnable import scripts and a query a judge can run. Hedera’s x402 card requires a transaction ID and a HashScan link. Whitechain requires a verified contract and a transfer of one specific token. ENS and World both say hard-coded or cosmetic use does not qualify. Definitive requires an onchain fill plus a public social post.
- **“Agent” is on most of the larger cards,** with different proof standards. World wants a human verification around an action and says current Agent Pass proofs are mocked. 0G wants a request ID and, on the self-funding track, a balance that drops without a human top-up. Hedera wants a paid request with no human approval. Arc’s Discovery track wants the agent to pay USDC and the user to have spend controls. Whitechain Scale wants the payer, who may be an agent, to pay USDT without holding the gas token. Definitive’s from-scratch track is specifically a **social** trading app; the open-ended agent workflow is the continuity track. Chainlink CRE explicitly allows a CLI simulation. Ethereum Foundation’s alt-mempool prize is about transaction types, not agents; CROPS is about the four properties.
- **Identity prizes have already paid org-subname managers and human-gated agents.** ENS Subname Manager (New York, Sepolia, email to name) and the Tokyo ENS set (delegation, branches, credentials, collectibles, messaging) are public. World’s Tokyo winners are three agent-consent products at equal $2,500 under a mocked-proof card that Mumbai repeats.
- **Payment-rail prizes have already paid API wrappers and marketplaces.** Glassbox402, the August 2026 Hedera x402 bounty (Pinout, Tally, Xorv, Qisma), Accrue, and Mars are public Hedera-adjacent payment or escrow projects. Whitechain’s Operate card says a plain transfer will not place. Its Scale card says an agent chat that never pays will not place.
- **Hook and auction literacy is already in the Uniswap winner set.** OniBlock, Bailiff, Reckn, VexiHakari, and Cook Some Hooks are public v4-hook or hook-adjacent projects. CCA is named on the Mumbai card and documented, and was not found in that winner set.
- **Aqua winners that published details used official contracts, often a custom SwapVM instruction, and a real testnet or a fork.** ArcBook used Base Sepolia. Agora’s author used Sepolia core plus a fork for tests, and said part of the mechanism was not deployed. KSwap-VM placed with formal verification rather than a position UI. The card allows either tests or a UI, and says SwapVM scores higher.
- **New or thinly indexed at the events checked:** Arkiv, Whitechain, Definitive Flash, Anon-RPC, and the alt mempool had no winner rows in the Lisbon / Tokyo / New York Medalist pages used here. Arc, 0G, Hedera, ENS, Uniswap, World, 1inch, and Chainlink did.

## Live probe log

All successful unless noted. Around 16:05–16:20 UTC, 5 November 2026.

| Target | Result |
| --- | --- |
| `GET https://x402.org/facilitator/supported` | JSON. `hedera:testnet` exact v2, fee payer `0.0.9185802`. No `hedera:mainnet` kind in the body. |
| `GET https://api.testnet.blocky402.com/supported` | `hedera:testnet` exact v2, fee payer `0.0.7162784`. |
| `GET https://testnet.facilitator.launa.dev/supported` | `hedera:testnet` exact v2, fee payer `0.0.9839454`. |
| `GET https://api.blocky402.com/supported` | `hedera:mainnet` exact v2, fee payer `0.0.10571514`. |
| Hedera testnet mirror `/api/v1/network/supply` | HTTP 200. |
| Mirror token `0.0.429274` | USDC, 6 decimals, fungible. |
| Mainnet mirror token `0.0.456858` | USDC, 6 decimals, fungible. |
| Whitechain explorer token API for `0xcedf…55a7` | ERC-20, symbol USDT, 6 decimals, supply `1945270000000`, holders `91`. |
| Arkiv Rabdi `eth_chainId` | `0x76edaf` (7794095). |
| `https://pc.0g.ai/models` | HTTP 200. Body not parsed. |
| `https://docs.altmempool.wtf/` | HTTP 200. |
| `https://ethereum.github.io/anon-rpc/` | HTTP 200. |
| `https://flash.definitive.fi/docs` | HTTP 200. |
| `https://auth.world.org/` | HTTP 200. |
| `https://studio.arc.io` | HTTP 200. |
| `https://docs.hedera.com/solutions/ai/x402/facilitators` | HTTP 200. |
| `https://docs.chain.link/ccip` | HTTP 200. |
| `https://developers.circle.com/agent-stack/agent-marketplace/discovery-api` | HTTP 200. |
| `https://docs.world.org/world-id/idkit/integrate` | HTTP 200. |
| `https://sourcify.arkiv.network` | HTTP 200. |
| `https://github.com/0gfoundation/zerobot` | HTTP 200. |
| `https://docs.whitechain.io` | HTTP 308. |
| `https://ethglobal.com/events/mumbai/info/start` | Timed out. Not re-fetched. |
| npm `@x402/hedera` | 2.30.0, published 2026-11-04T20:08:33.929Z. |
| npm `@x402/core`, `@x402/next` | 2.30.0. |
| npm `@arkiv-network/sdk` | 1.0.1. |
| npm `@anon-rpc/browser-harness` | 0.4.0. |
| npm `comfy-cli` | 0.9.4. |

## Pages this brief did not finish

- Full text of World Agent Pass docs, IDKit credential docs, Arc Studio behavior, Discovery API schema, Bridge Kit expanded-asset list, ATS and Stablecoin Studio, Anon-RPC wallet guide, alt-mempool devnet endpoints, EF mandate blog, Chainlink CRE getting-started, Definitive order API schema, Whitechain faucet rules, 1inch whitepapers, ENSv2 contract tutorial.
- A direct copy of the Mumbai start page.
- Winner write-ups for Vouch, OddsFlow, Wamia, watermark, Aegis, AgentIndex, Aragorn, Radius, ENS Drive, Tide, the Lisbon no-Solidity winners, and the New York Arc tracks other than Mars.
- Any test that spent value: no x402 settle, no 0G inference call, no Flash order, no CCIP message, no ENS registration.

When a later page contradicts a sentence here, the later primary page wins. Package versions and facilitator fee payers in particular were true at probe time and are advertised dynamically.
