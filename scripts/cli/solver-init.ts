import { Command } from "commander";
import { loadEnv, report, requireKey, requireRpc, sdkExport } from "./io.ts";

/** Flags from `SolverInitFlags` in specs/sdk-api.d.ts. */
type SolverInitFlags = {
  label: string;
  rpc?: string;
  keyEnv?: string;
};

const program = new Command();

program
  .name("solver:init")
  .description("Register a solver name and print the result.")
  .helpOption("--help", "display help")
  .requiredOption("--label <label>", "solver label")
  .option("--rpc <rpc>", "HTTP RPC URL, or SEPOLIA_RPC_URL when omitted")
  .option("--key-env <keyEnv>", "private key env var (default SOLVER_PRIVATE_KEY)")
  .action(async (flags: SolverInitFlags) => {
    loadEnv();
    const label = flags.label.trim();
    if (!label) {
      console.error("--label is required");
      process.exit(1);
    }
    try {
      const initSolver = await sdkExport("initSolver");
      const result = await initSolver({
        label,
        key: requireKey(flags.keyEnv),
        rpc: requireRpc(flags.rpc),
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      report(error);
    }
  });

program.parseAsync(process.argv).catch(report);
