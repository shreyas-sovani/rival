/** Wire types shared by the curve, the EIP-712 witness, and the public package API. */

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

/** Settlement domain. Not mixed into the intent struct hash; checked so callers pass a real domain. */
export interface IntentDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

export interface TypedDataField {
  name: string;
  type: string;
}

export const INTENT_TYPE =
  "Intent(address maker,address tokenIn,address tokenOut,uint128 amountIn,address recipient,uint8 mode,uint128 baseOut,uint32 oracleWindow,int32 startBps,int32 floorBps,uint32 startTime,uint32 decaySecs,uint32 deadline,uint128 hardMinOut,uint8 gate,bytes32 allowlistHash,uint256 nonce)";

/**
 * Suffix Permit2 concatenates onto
 * `PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,`.
 * Copied from the pinned Permit2 `PermitHash._PERMIT_TRANSFER_FROM_WITNESS_TYPEHASH_STUB`.
 */
export const WITNESS_TYPE_STRING = `Intent witness)${INTENT_TYPE}TokenPermissions(address token,uint256 amount)`;

export const INTENT_FIELDS: readonly TypedDataField[] = [
  { name: "maker", type: "address" },
  { name: "tokenIn", type: "address" },
  { name: "tokenOut", type: "address" },
  { name: "amountIn", type: "uint128" },
  { name: "recipient", type: "address" },
  { name: "mode", type: "uint8" },
  { name: "baseOut", type: "uint128" },
  { name: "oracleWindow", type: "uint32" },
  { name: "startBps", type: "int32" },
  { name: "floorBps", type: "int32" },
  { name: "startTime", type: "uint32" },
  { name: "decaySecs", type: "uint32" },
  { name: "deadline", type: "uint32" },
  { name: "hardMinOut", type: "uint128" },
  { name: "gate", type: "uint8" },
  { name: "allowlistHash", type: "bytes32" },
  { name: "nonce", type: "uint256" },
];
