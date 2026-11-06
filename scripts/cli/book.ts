import { Command, Option } from "commander";
import { integerFlag, loadEnv, oneOf, printResult, report, sdkExport } from "./io.ts";

/** Flags from `CliBookFlags` in specs/sdk-api.d.ts. */
type CliBookFlags = {
  pair?: string;
  status?: "open" | "filled" | "cancelled";
  min?: string;
  max?: string;
  mode?: "absolute" | "pegged";
  gate?: "open" | "listed" | "named";
  deadlineAfter?: string;
};

const STATUSES = ["open", "filled", "cancelled"] as const;
const MODES = ["absolute", "pegged"] as const;
const GATES = ["open", "listed", "named"] as const;

const program = new Command();

program
  .name("cli:book")
  .description("Print the intent book.")
  .helpOption("--help", "display help")
  .option("--pair <pair>", "token pair")
  .addOption(new Option("--status <status>", "open, filled, or cancelled"))
  .option("--min <min>", "minimum amountIn integer")
  .option("--max <max>", "maximum amountIn integer")
  .addOption(new Option("--mode <mode>", "absolute or pegged"))
  .addOption(new Option("--gate <gate>", "open, listed, or named"))
  .option("--deadline-after <deadlineAfter>", "deadline after this unix time")
  .action(async (flags: CliBookFlags) => {
    loadEnv();
    const status = oneOf("--status", flags.status, STATUSES);
    const modeName = oneOf("--mode", flags.mode, MODES);
    const gateName = oneOf("--gate", flags.gate, GATES);
    const minAmountIn = integerFlag("--min", flags.min);
    const maxAmountIn = integerFlag("--max", flags.max);
    const deadlineAfter = integerFlag("--deadline-after", flags.deadlineAfter);
    const query: {
      pair?: string;
      status?: (typeof STATUSES)[number];
      minAmountIn?: bigint;
      maxAmountIn?: bigint;
      mode?: 0 | 1;
      gate?: 0 | 1 | 2;
      deadlineAfter?: bigint;
    } = {};
    if (flags.pair !== undefined) query.pair = flags.pair;
    if (status !== undefined) query.status = status;
    if (minAmountIn !== undefined) query.minAmountIn = minAmountIn;
    if (maxAmountIn !== undefined) query.maxAmountIn = maxAmountIn;
    if (modeName !== undefined) query.mode = modeName === "absolute" ? 0 : 1;
    if (gateName === "open") query.gate = 0;
    if (gateName === "listed") query.gate = 1;
    if (gateName === "named") query.gate = 2;
    if (deadlineAfter !== undefined) query.deadlineAfter = deadlineAfter;
    const getBook = await sdkExport("getBook");
    printResult(await getBook(query));
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  report(error);
}
