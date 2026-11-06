export type Address = `0x${string}`;
export type Hex = `0x${string}`;

/** 0 absolute, 1 pegged. */
export type Mode = 0 | 1;
/** 0 open, 1 listed, 2 named. */
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
