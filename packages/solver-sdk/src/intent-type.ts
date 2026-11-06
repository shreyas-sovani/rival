import type { Address, Intent } from "./types.ts";

/** Same struct string as `packages/intent` `INTENT_TYPE`. Kept local so this package does not import it. */
export const INTENT_TYPE =
  "Intent(address maker,address tokenIn,address tokenOut,uint128 amountIn,address recipient,uint8 mode,uint128 baseOut,uint32 oracleWindow,int32 startBps,int32 floorBps,uint32 startTime,uint32 decaySecs,uint32 deadline,uint128 hardMinOut,uint8 gate,bytes32 allowlistHash,uint256 nonce)";

export const INTENT_FIELDS = [
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
] as const;

export const INTENT_DOMAIN_NAME = "RivalSettlement";
export const INTENT_DOMAIN_VERSION = "1";

export function intentDomain(chainId: number, verifyingContract: Address) {
  return {
    name: INTENT_DOMAIN_NAME,
    version: INTENT_DOMAIN_VERSION,
    chainId,
    verifyingContract,
  } as const;
}

export function intentTypedData(intent: Intent, chainId: number, verifyingContract: Address) {
  return {
    domain: intentDomain(chainId, verifyingContract),
    types: { Intent: INTENT_FIELDS },
    primaryType: "Intent" as const,
    message: {
      maker: intent.maker,
      tokenIn: intent.tokenIn,
      tokenOut: intent.tokenOut,
      amountIn: intent.amountIn,
      recipient: intent.recipient,
      mode: intent.mode,
      baseOut: intent.baseOut,
      oracleWindow: intent.oracleWindow,
      startBps: intent.startBps,
      floorBps: intent.floorBps,
      startTime: intent.startTime,
      decaySecs: intent.decaySecs,
      deadline: intent.deadline,
      hardMinOut: intent.hardMinOut,
      gate: intent.gate,
      allowlistHash: intent.allowlistHash,
      nonce: intent.nonce,
    },
  };
}
