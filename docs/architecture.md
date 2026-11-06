### 6.1 System architecture

```mermaid
flowchart LR
  subgraph Browser["User browser (static app)"]
    UI["Next.js static export"]
    W["On-device wallet and EIP-712 signer"]
    ARKR["Arkiv client (SDK on viem)"]
    ENSR["ENS reader: UniversalResolverV2"]
    UI --> W
    UI --> ARKR
    UI --> ENSR
  end
  subgraph Rabdi["Arkiv Rabdi: public book"]
    INT["rival.intent.v1 (expiring)"]
    PRES["rival.solver.v1 (3 min presence)"]
  end
  subgraph Sepolia["Ethereum Sepolia"]
    PM["Uniswap v4 PoolManager"]
    HOOK["RivalOracleHook"]
    POOLA["Pool A (hooked, 0.05%)"]
    POOLB["Pool B (0.30%)"]
    P2["Permit2"]
    SET["RivalSettlement"]
    REG["SolverRegistry"]
    NAMES["RivalNames"]
    ENSV2["ENSv2 registries and resolver: solvers.rival.eth"]
    USOL["UniswapSolver (fill contract)"]
    PM --> POOLA
    PM --> POOLB
    POOLA --- HOOK
    SET --> P2
    SET --> HOOK
    SET --> REG
    REG --> NAMES
    NAMES --> ENSV2
    REG -. "ownerOf (gating)" .-> ENSV2
    USOL --> PM
    SET -->|"fill callback"| USOL
  end
  subgraph Runner["Runner (optional, replaceable)"]
    PUB["Publisher and validator"]
    IDX["Indexer: status patcher"]
    MM["Market maker and heartbeat"]
    BOTS["Solver bots x4 and house"]
    FCT["Faucet"]
  end
  W -->|"signed intent"| PUB
  PUB --> INT
  IDX --> INT
  BOTS -->|"read intents"| INT
  BOTS --> PRES
  ARKR --> INT
  ARKR --> PRES
  BOTS -->|"fill()"| SET
  MM --> PM
  FCT --> SET
  UI -.->|"reads"| SET
```

### 6.2 One fill, end to end

```mermaid
sequenceDiagram
  autonumber
  participant M as Maker browser
  participant P as Publisher (runner)
  participant A as Arkiv book
  participant S as Solver bot
  participant ST as RivalSettlement
  participant P2 as Permit2
  participant U as UniswapSolver
  participant PM as v4 PoolManager
  participant H as RivalOracleHook
  participant R as SolverRegistry
  M->>M: sign Intent (Permit2 witness), no gas
  M->>P: intent and signature
  P->>P: validate, simulate fill
  P->>A: createEntity (expires at deadline+5m)
  S->>A: query open intents
  S->>S: verify signature, compute required(t), cost
  S->>ST: fill(intent, sig, params)
  ST->>H: quote (TWAP, block-start)
  ST->>P2: permitWitnessTransferFrom (maker to solver)
  ST->>U: rivalFillCallback
  U->>PM: unlock, swap exact-in, take output
  U->>ST: approve required output
  ST->>ST: transfer required to recipient, check delta
  ST->>R: onFill (stats), ENS records via try/catch
  ST-->>M: Filled event (receipt)
```

### 6.3 Intent state machine

```mermaid
stateDiagram-v2
  [*] --> Signed
  Signed --> Published: publisher validates, Arkiv entity created
  Published --> Live: startTime reached
  Live --> Filled: solver fill() succeeds
  Published --> Cancelled: cancel or cancelBySig
  Live --> Cancelled: cancel or cancelBySig
  Live --> Expired: now greater than deadline
  Filled --> [*]
  Cancelled --> [*]
  Expired --> [*]
```

### 6.4 ENS name tree and permissions

```mermaid
flowchart TD
  ETH["eth (ETHRegistry)"] --> PARENT["rival.eth (registered via ETHRegistrar)"]
  PARENT --> SREG["solvers.rival.eth (UserRegistry via VerifiableFactory)"]
  SREG --> ATLAS["atlas.solvers.rival.eth"]
  SREG --> MER["meridian.solvers.rival.eth"]
  SREG --> HOUSE["house.solvers.rival.eth"]
  SREG --> JUDGE["judge1.solvers.rival.eth (self-registered)"]
  NAMES["RivalNames: roles REGISTRAR, RENEW, UNREGISTER on solvers registry; sole writer of com.rival.* records"] -. "EAC" .-> SREG
  OWNER["Solver (name owner): edits description, url, agent-context, agent-endpoint, agent-registration; no transfer role"] -. "EAC per record" .-> ATLAS
  SET["RivalSettlement and SolverRegistry: read ownerOf for gating"] -. "read" .-> SREG
```

### 6.5 Oracle timeline (why same-block manipulation cannot move the price)

```mermaid
flowchart LR
  B1["Block N-1: swaps move tick to t1"] --> O1["Block N first swap: observation records block-start tick t1"]
  O1 --> B2["Block N later swaps: attacker pushes tick to t2"]
  B2 --> C["consult in block N uses tick t1 for the open segment because latest.ts equals now"]
  C --> D["TWAP unchanged by block-N manipulation"]
```
