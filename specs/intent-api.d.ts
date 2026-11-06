/// <reference lib="es2022" />
/**
 * Public surface of `@rival/intent` (F5). Implementations live in the package.
 * Curve math is PRD §7.2. `improvementBps === -2147483648` is the oracle-unavailable sentinel
 * (`type(int32).min`) and must not be averaged into solver stats.
 */

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

/** 0 ABSOLUTE, 1 PEGGED. Matches the Solidity `Mode` enum. */
export type Mode = 0 | 1;
/** 0 open, 1 listed, 2 named. Matches the Solidity `Gate` enum. */
export type Gate = 0 | 1 | 2;

export interface Intent {
  maker: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  recipient: Address;
  mode: Mode;
  baseOut: bigint;
  oracleWindow: number;
  startBps: number;
  floorBps: number;
  startTime: number;
  decaySecs: number;
  deadline: number;
  hardMinOut: bigint;
  gate: Gate;
  allowlistHash: Hex;
  nonce: bigint;
}

export interface IntentDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

export type PresetId = "fast" | "balanced" | "patient";

export interface Preset {
  id: PresetId;
  decaySecs: number;
  startBps: number;
  floorBps: number;
  /** Hard floor is `oracleQuote * hardFloorRatioBps / 10_000`. Balanced default is 9850 (98.5%). */
  hardFloorRatioBps: number;
  /** `deadline = startTime + decaySecs + deadlineBufferSecs`. */
  deadlineBufferSecs: number;
}

export declare const presets: {
  readonly fast: Preset;
  readonly balanced: Preset;
  readonly patient: Preset;
};

export interface BuildIntentInput {
  maker: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  recipient?: Address;
  preset?: PresetId;
  mode?: Mode;
  baseOut?: bigint;
  oracleWindow?: number;
  startBps?: number;
  floorBps?: number;
  startTime?: number;
  decaySecs?: number;
  deadline?: number;
  hardMinOut?: bigint;
  gate?: Gate;
  /** Named-gate label hashes. `allowlistHash` is `keccak256(concat(labels))`. */
  allowLabels?: Hex[];
  nonce: bigint;
  /** Used to derive `hardMinOut` when `hardMinOut` is omitted. */
  oracleQuoteOut?: bigint;
}

export declare function buildIntent(input: BuildIntentInput): Intent;

/** EIP-712 struct hash of `intent` (not the signing digest). */
export declare function hashIntent(intent: Intent, domain: IntentDomain): Hex;

export interface TypedDataField {
  name: string;
  type: string;
}

export interface Permit2TypedData {
  domain: {
    name: "Permit2";
    chainId: number;
    verifyingContract: Address;
  };
  types: Record<string, readonly TypedDataField[]>;
  primaryType: "PermitWitnessTransferFrom";
  message: Record<string, unknown>;
  /** Witness type definition followed by `TokenPermissions(address token,uint256 amount)`. */
  witnessTypeString: string;
}

export declare function permit2TypedData(args: {
  intent: Intent;
  permit2: Address;
  settlement: Address;
  chainId: number;
}): Permit2TypedData;

export interface RequiredAt {
  required: bigint;
  curveBps: number;
  base: bigint;
}

/**
 * Curve at `ts`. `quoteOut` is the hook quote when `mode` is pegged and is ignored when absolute.
 * Throws when `decaySecs` is 0 or the bps window is outside [-5000, 5000] or `startBps < floorBps`.
 */
export declare function requiredAt(args: {
  mode: Mode;
  baseOut: bigint;
  quoteOut: bigint;
  startBps: number;
  floorBps: number;
  startTime: number;
  decaySecs: number;
  hardMinOut: bigint;
  ts: number;
}): RequiredAt;

export interface ReceiptMathResult {
  fairOut: bigint;
  fairOutAfterFee: bigint;
  /** Sentinel `-2147483648` when `fairOut` is 0. */
  improvementBps: number;
  elapsed: number;
}

/**
 * `fairOut` 0 means the oracle was unavailable.
 * `improvementBps` truncates toward zero, then clamps to [-10000, 10000].
 * `poolFee` is the Uniswap v4 fee in hundredths of a bip (500 = 0.05%).
 */
export declare function receiptMath(args: {
  amountOut: bigint;
  fairOut: bigint;
  poolFee: number;
  curveBps: number;
  elapsed: number;
}): ReceiptMathResult;

export declare function verifyIntentSignature(args: {
  intent: Intent;
  signature: Hex;
  permit2: Address;
  settlement: Address;
  chainId: number;
}): Promise<boolean>;
