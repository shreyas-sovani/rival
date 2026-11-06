import { Command, Option } from "commander";
import { loadEnv, oneOf, printResult, report, requireKey, requireRpc, sdkExport } from "./io.ts";

/** Flags from `CliIntentFlags` in specs/sdk-api.d.ts. */
type CliIntentFlags = {
  sell: string;
  preset?: "fast" | "balanced" | "patient";
  gate?: "open" | "listed" | "named";
  label?: string[];
  mode?: "absolute" | "pegged";
  keyEnv?: string;
  rpc?: string;
};

const PRESETS = ["fast", "balanced", "patient"] as const;
const GATES = ["open", "listed", "named"] as const;
const MODES = ["absolute", "pegged"] as const;

const program = new Command();

program
  .name("cli:intent")
  .description("Sign and publish an intent.")
  .helpOption("--help", "display help")
  .requiredOption("--sell <sell>", "tWETH amount in whole tokens (required)")
  .addOption(new Option("--preset <preset>", "fast, balanced, or patient"))
  .addOption(new Option("--gate <gate>", "open, listed, or named"))
  .addOption(
    new Option("--label <label>", "solver label (repeatable)").argParser(
      (value: string, previous: string[] | undefined) => [...(previous ?? []), value],
    ),
  )
  .addOption(new Option("--mode <mode>", "absolute or pegged"))
  .option("--key-env <keyEnv>", "private key env var (default SOLVER_PRIVATE_KEY)")
  .option("--rpc <rpc>", "HTTP RPC URL, or SEPOLIA_RPC_URL when omitted")
  .action(async (flags: CliIntentFlags) => {
    loadEnv();
    const preset = oneOf("--preset", flags.preset, PRESETS);
    const gate = oneOf("--gate", flags.gate, GATES);
    const mode = oneOf("--mode", flags.mode, MODES);
    const key = requireKey(flags.keyEnv);
    const rpc = requireRpc(flags.rpc);
    const signAndPublish = await sdkExport("signAndPublish");
    const opts: {
      sell: string;
      preset?: (typeof PRESETS)[number];
      gate?: (typeof GATES)[number];
      labels?: string[];
      mode?: (typeof MODES)[number];
      key: `0x${string}`;
      rpc: string;
    } = { sell: flags.sell, key, rpc };
    if (preset !== undefined) opts.preset = preset;
    if (gate !== undefined) opts.gate = gate;
    if (mode !== undefined) opts.mode = mode;
    if (flags.label && flags.label.length > 0) opts.labels = flags.label;
    printResult(await signAndPublish(opts));
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  report(error);
}
