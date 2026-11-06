### S-900 — Example
- STATE: DONE
- OWNER: SLAVE
- PRD: §6.3
- DEPENDS: —
- INPUTS: none
- TOUCHES: scripts/
- BUDGET: 0.1
- AUTO: yes
- DO:
  - one step
- VERIFY:
  ```bash
  echo ok
  ```
- DONE-WHEN: prints ok
- STARTED: 2026-11-06T00:00:00Z
- PROOF: abcdef1 | echo ok | exit 0 | -
- BLOCKED-BY:
- NOTES: fixture

### M-900 — Blocked example
- STATE: TODO
- OWNER: MASTER
- PRD: §6.3
- DEPENDS: S-900
- INPUTS: none
- TOUCHES: contracts/src/**
- BUDGET: 0.1
- AUTO: yes
- DO:
  - wait
- VERIFY:
  ```bash
  echo wait
  ```
- DONE-WHEN: after the dependency
- STARTED:
- PROOF:
- BLOCKED-BY:
- NOTES:
