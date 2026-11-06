import { Command, Option } from "commander";
import { loadEnv, oneOf, report, requireKey, requireRpc, sdkExport } from "./io.ts";

/** Flags from `SolverDevFlags` in specs/sdk-api.d.ts. */
type SolverDevFlags = {
  label?: string;
  rpc?: string;
  keyEnv?: string;
  strategy?: "sprint" | "patient" | "arb" | "inventory" | "house";
};

const STRATEGIES = ["sprint", "patient", "arb", "inventory", "house"] as const;

const program = new Command();

program
  .name("solver:dev")
  .description("Run a solver process until shutdown.")
  .helpOption("--help", "display help")
  .option("--label <label>", "solver label")
  .option("--rpc <rpc>", "HTTP RPC URL, or SEPOLIA_RPC_URL when omitted")
  .option("--key-env <keyEnv>", "private key env var (default SOLVER_PRIVATE_KEY)")
  .addOption(new Option("--strategy <strategy>", "sprint, patient, arb, inventory, or house"))
  .action(async (flags: SolverDevFlags) => {
    loadEnv();
    const strategy = oneOf("--strategy", flags.strategy, STRATEGIES);
    const label = flags.label?.trim() ?? "";
    if (!label) {
      console.error("--label is required");
      process.exit(1);
    }
    try {
      const runSolver = await sdkExport("runSolver");
      await runSolver({
        label,
        key: requireKey(flags.keyEnv),
        rpc: requireRpc(flags.rpc),
        ...(strategy ? { strategy } : {}),
      });
    } catch (error) {
      report(error);
    }
  });

program.parseAsync(process.argv).catch(report);
