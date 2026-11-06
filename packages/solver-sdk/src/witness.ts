import {
  encodeAbiParameters,
  encodePacked,
  getAddress,
  hashTypedData,
  keccak256,
  recoverAddress,
  toHex,
  type Hex,
} from "viem";
import { INTENT_FIELDS, INTENT_TYPE } from "./intent-type.ts";
import type { Address, Intent } from "./types.ts";

/**
 * Permit2 witness suffix. Byte-for-byte `RivalSettlement.WITNESS_TYPE_STRING`
 * (`contracts/src/RivalSettlement.sol`). Permit2 prepends
 * `PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,`.
 */
export const WITNESS_TYPE_STRING =
  `Intent witness)${INTENT_TYPE}TokenPermissions(address token,uint256 amount)`;

const PERMIT_WITNESS_STUB =
  "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,";

const TOKEN_PERMISSIONS_TYPE = "TokenPermissions(address token,uint256 amount)";

const PERMIT_TYPES = {
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "witness", type: "Intent" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  Intent: INTENT_FIELDS,
} as const;

export interface Permit2WitnessArgs {
  intent: Intent;
  /** Canonical Permit2. Domain `verifyingContract`. */
  permit2: Address;
  /** Settlement contract. Permit2 spender bound into the witness. */
  settlement: Address;
  chainId: number;
}

export type WitnessVerdict =
  | { accept: true; structHash: Hex; digest: Hex; signer: Address }
  | { accept: false; reason: "forged" | "bad params" };

function witnessMessage(intent: Intent) {
  return {
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
  };
}

/** EIP-712 struct hash of `Intent`. This is the Permit2 witness, not the signing digest. */
export function intentStructHash(intent: Intent): Hex {
  const typehash = keccak256(toHex(INTENT_TYPE));
  const encoded = encodeAbiParameters(
    [
      { type: "bytes32" },
      { type: "address" },
      { type: "address" },
      { type: "address" },
      { type: "uint128" },
      { type: "address" },
      { type: "uint8" },
      { type: "uint128" },
      { type: "uint32" },
      { type: "int32" },
      { type: "int32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint128" },
      { type: "uint8" },
      { type: "bytes32" },
      { type: "uint256" },
    ],
    [
      typehash,
      intent.maker,
      intent.tokenIn,
      intent.tokenOut,
      intent.amountIn,
      intent.recipient,
      intent.mode,
      intent.baseOut,
      intent.oracleWindow,
      intent.startBps,
      intent.floorBps,
      intent.startTime,
      intent.decaySecs,
      intent.deadline,
      intent.hardMinOut,
      intent.gate,
      intent.allowlistHash,
      intent.nonce,
    ],
  );
  return keccak256(encoded);
}

export function permit2WitnessTypedData(args: Permit2WitnessArgs) {
  return {
    domain: {
      name: "Permit2" as const,
      chainId: args.chainId,
      verifyingContract: args.permit2,
    },
    types: PERMIT_TYPES,
    primaryType: "PermitWitnessTransferFrom" as const,
    message: {
      permitted: { token: args.intent.tokenIn, amount: args.intent.amountIn },
      spender: args.settlement,
      nonce: args.intent.nonce,
      deadline: BigInt(args.intent.deadline),
      witness: witnessMessage(args.intent),
    },
  };
}

/**
 * Permit2 signing digest for `intent`.
 * The typehash is `keccak256(stub ‖ WITNESS_TYPE_STRING)`, the same suffix settlement passes to Permit2.
 * viem `hashTypedData` must agree; a mismatch means the type string drifted from EIP-712 encoding.
 */
export function permit2WitnessDigest(args: Permit2WitnessArgs): Hex {
  if (!Number.isSafeInteger(args.chainId) || args.chainId <= 0) {
    throw new Error("bad params");
  }
  const permit2 = getAddress(args.permit2);
  const settlement = getAddress(args.settlement);
  const typeHash = keccak256(encodePacked(["string", "string"], [PERMIT_WITNESS_STUB, WITNESS_TYPE_STRING]));
  const tokenPermissionsHash = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }, { type: "uint256" }],
      [keccak256(toHex(TOKEN_PERMISSIONS_TYPE)), args.intent.tokenIn, args.intent.amountIn],
    ),
  );
  const structHash = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "bytes32" },
      ],
      [typeHash, tokenPermissionsHash, settlement, args.intent.nonce, BigInt(args.intent.deadline), intentStructHash(args.intent)],
    ),
  );
  const domainSeparator = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
      ],
      [
        keccak256(toHex("EIP712Domain(string name,uint256 chainId,address verifyingContract)")),
        keccak256(toHex("Permit2")),
        BigInt(args.chainId),
        permit2,
      ],
    ),
  );
  const rebuilt = keccak256(encodePacked(["bytes2", "bytes32", "bytes32"], ["0x1901", domainSeparator, structHash]));
  const viaViem = hashTypedData(permit2WitnessTypedData({ ...args, permit2, settlement }));
  if (rebuilt !== viaViem) {
    throw new Error(`witness digest mismatch rebuilt=${rebuilt} viem=${viaViem}`);
  }
  return rebuilt;
}

/** Recover the Permit2 witness signer. Accepts only when that signer is `intent.maker`. */
export async function verifyWitness(args: Permit2WitnessArgs & { signature: Hex }): Promise<WitnessVerdict> {
  let digest: Hex;
  let structHash: Hex;
  try {
    structHash = intentStructHash(args.intent);
    digest = permit2WitnessDigest(args);
  } catch {
    return { accept: false, reason: "bad params" };
  }
  try {
    const signer = getAddress(await recoverAddress({ hash: digest, signature: args.signature }));
    if (signer !== getAddress(args.intent.maker)) return { accept: false, reason: "forged" };
    return { accept: true, structHash, digest, signer };
  } catch {
    return { accept: false, reason: "forged" };
  }
}
