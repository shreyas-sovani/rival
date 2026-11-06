import type { Address, Gate, Hex, Intent, Mode } from "@rival/intent";

/** JSON shape of `specs/runner-api.json` Intent. Amounts are decimal strings. */
export interface WireIntent {
  maker: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  recipient: Address;
  mode: Mode;
  baseOut: string;
  oracleWindow: number;
  startBps: number;
  floorBps: number;
  startTime: number;
  decaySecs: number;
  deadline: number;
  hardMinOut: string;
  gate: Gate;
  allowlistHash: Hex;
  nonce: string;
}

export function intentToWire(intent: Intent): WireIntent {
  return {
    maker: intent.maker,
    tokenIn: intent.tokenIn,
    tokenOut: intent.tokenOut,
    amountIn: intent.amountIn.toString(),
    recipient: intent.recipient,
    mode: intent.mode,
    baseOut: intent.baseOut.toString(),
    oracleWindow: intent.oracleWindow,
    startBps: intent.startBps,
    floorBps: intent.floorBps,
    startTime: intent.startTime,
    decaySecs: intent.decaySecs,
    deadline: intent.deadline,
    hardMinOut: intent.hardMinOut.toString(),
    gate: intent.gate,
    allowlistHash: intent.allowlistHash,
    nonce: intent.nonce.toString(),
  };
}

function uint(value: string, label: string): bigint {
  if (!/^[0-9]+$/.test(value)) throw new Error(`${label} is not a decimal string`);
  return BigInt(value);
}

export function wireToIntent(wire: WireIntent): Intent {
  return {
    maker: wire.maker,
    tokenIn: wire.tokenIn,
    tokenOut: wire.tokenOut,
    amountIn: uint(wire.amountIn, "amountIn"),
    recipient: wire.recipient,
    mode: wire.mode,
    baseOut: uint(wire.baseOut, "baseOut"),
    oracleWindow: wire.oracleWindow,
    startBps: wire.startBps,
    floorBps: wire.floorBps,
    startTime: wire.startTime,
    decaySecs: wire.decaySecs,
    deadline: wire.deadline,
    hardMinOut: uint(wire.hardMinOut, "hardMinOut"),
    gate: wire.gate,
    allowlistHash: wire.allowlistHash,
    nonce: uint(wire.nonce, "nonce"),
  };
}
