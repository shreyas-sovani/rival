import { Command } from "commander";
import { applyRpc, loadEnv, printResult, report, sdkExport } from "./io.ts";

/** Flags from `CliVerifyFlags` in specs/sdk-api.d.ts. The positional argument is `tx`. */
type CliVerifyOptions = {
  rpc?: string;
};

const program = new Command();

program
  .name("cli:verify")
  .description("Print a fill verification.")
  .helpOption("--help", "display help")
  .argument("<tx>", "fill transaction hash")
  .option("--rpc <rpc>", "HTTP RPC URL, written to SEPOLIA_RPC_URL")
  .action(async (tx: string, flags: CliVerifyOptions) => {
    loadEnv();
    applyRpc(flags.rpc);
    if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) {
      console.error("tx must be a 0x-prefixed 32-byte hash");
      process.exit(1);
    }
    const verifyFill = await sdkExport("verifyFill");
    printResult(await verifyFill(tx));
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  report(error);
}
