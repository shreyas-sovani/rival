/// <reference lib="es2022" />
/**
 * Public surface of `@rival/solver-sdk` and the CLI flag schemas (F5).
 * Wrappers parse these flags and call the functions. They do not reimplement them.
 */

export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export type StrategyId = "sprint" | "patient" | "arb" | "inventory" | "house";

export interface SolverConfig {
  label: string;
  key: Hex;
  rpc: string;
  strategy?: StrategyId;
}

export interface InitSolverResult {
  address: Address;
  label: string;
  listed: boolean;
}

export declare function initSolver(opts: { label: string; key: Hex; rpc: string }): Promise<InitSolverResult>;

/** Blocks, watching Arkiv (or the degraded feed) and submitting fills. Resolves on shutdown. */
export declare function runSolver(config: SolverConfig): Promise<void>;

export interface VerifyFillResult {
  txHash: Hex;
  intentHash: Hex;
  maker: Address;
  solver: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  amountOut: string;
  fairOut: string;
  fairOutAfterFee: string;
  improvementBps: number;
  curveBps: number;
  elapsed: number;
  /** True when the recomputed receipt matches the `Filled` log. */
  matchesReceipt: boolean;
}

export declare function verifyFill(txHash: Hex): Promise<VerifyFillResult>;

export interface WatchIntentsOpts {
  pair?: string;
  status?: "open" | "filled" | "cancelled";
}

export interface WatchedIntent {
  intentHash: Hex;
  maker: Address;
  pair: string;
  amountIn: string;
  deadline: string;
  status: string;
  signatureOk: boolean;
}

export declare function watchIntents(opts: WatchIntentsOpts): AsyncIterable<WatchedIntent>;

export interface BookQuery {
  pair?: string;
  status?: "open" | "filled" | "cancelled";
  minAmountIn?: bigint;
  maxAmountIn?: bigint;
  mode?: 0 | 1;
  gate?: 0 | 1 | 2;
  deadlineAfter?: bigint;
  deadlineBefore?: bigint;
}

export interface BookRow {
  intentHash: string;
  maker: string;
  pair: string;
  amountIn: string;
  mode: string;
  gate: string;
  status: string;
  deadline: string;
  signatureOk: boolean;
}

export interface BookResult {
  /** Query string actually sent to Arkiv. */
  query: string;
  count: string;
  rows: BookRow[];
}

export declare function getBook(query: BookQuery): Promise<BookResult>;

export interface SignAndPublishOpts {
  sell: string;
  preset?: "fast" | "balanced" | "patient";
  gate?: "open" | "listed" | "named";
  labels?: string[];
  mode?: "absolute" | "pegged";
  key: Hex;
  rpc: string;
}

export interface SignAndPublishResult {
  intentHash: Hex;
  entityKey?: string;
  degraded: boolean;
}

export declare function signAndPublish(opts: SignAndPublishOpts): Promise<SignAndPublishResult>;

/** `pnpm cli:intent`. `--sell` is the tWETH amount in whole tokens (the PRD example is `--sell 1`). */
export interface CliIntentFlags {
  sell: string;
  preset?: "fast" | "balanced" | "patient";
  gate?: "open" | "listed" | "named";
  label?: string[];
  mode?: "absolute" | "pegged";
  keyEnv?: string;
  rpc?: string;
}

/** `pnpm cli:book`. */
export interface CliBookFlags {
  pair?: string;
  status?: "open" | "filled" | "cancelled";
  min?: string;
  max?: string;
  mode?: "absolute" | "pegged";
  gate?: "open" | "listed" | "named";
  deadlineAfter?: string;
}

/** `pnpm cli:verify <tx>`. The positional tx hash is `tx`. */
export interface CliVerifyFlags {
  tx: string;
  rpc?: string;
}

/** `pnpm solver:init`. */
export interface SolverInitFlags {
  label: string;
  rpc?: string;
  keyEnv?: string;
}

/** `pnpm solver:dev`. */
export interface SolverDevFlags {
  label?: string;
  rpc?: string;
  keyEnv?: string;
  strategy?: StrategyId;
}
