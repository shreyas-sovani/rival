/** Four steps. Commands are the PRD / S-010 strings, not paraphrases. */
export const SOLVER_INIT_COMMAND = "pnpm solver:init --label <name>";
export const SOLVER_DEV_COMMAND = "pnpm solver:dev";

export const RUN_A_SOLVER_STEPS: readonly { n: string; title: string; body: string; command?: string }[] = [
  {
    n: "1",
    title: "Copy the env file",
    body: "Copy `.env.example` to a local env file. Do not commit it.",
  },
  {
    n: "2",
    title: "Fill the three variables",
    body: "Fill `SEPOLIA_RPC_URL`, `SOLVER_PRIVATE_KEY`, and `ARKIV_ACCESS_KEY_WRITE`.",
  },
  {
    n: "3",
    title: "Register the name",
    body: "Register the solver label.",
    command: SOLVER_INIT_COMMAND,
  },
  {
    n: "4",
    title: "Run the process",
    body: "Start the solver.",
    command: SOLVER_DEV_COMMAND,
  },
];
