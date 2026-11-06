import { SignatureTransfer } from "@uniswap/permit2-sdk";
import {
  encodeAbiParameters,
  encodePacked,
  keccak256,
  toHex,
  verifyTypedData,
  type Hex,
} from "viem";
import {
  INTENT_FIELDS,
  INTENT_TYPE,
  WITNESS_TYPE_STRING,
  type Address,
  type Intent,
  type IntentDomain,
  type TypedDataField,
} from "./types.ts";

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

export interface Permit2TypedData {
  domain: {
    name: "Permit2";
    chainId: number;
    verifyingContract: Address;
  };
  types: Record<string, readonly TypedDataField[]>;
  primaryType: "PermitWitnessTransferFrom";
  message: Record<string, unknown>;
  witnessTypeString: string;
}

function assertDomain(domain: IntentDomain): void {
  if (!domain.name || !domain.version || domain.chainId <= 0 || !domain.verifyingContract.startsWith("0x")) {
    throw new Error("BadParams");
  }
}

/** EIP-712 struct hash of `Intent`. This is the Permit2 witness and `IRivalSettlement.intentHash`. */
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

/**
 * Struct hash of `intent`. `domain` is the settlement domain the app will bind later;
 * it is not part of this hash (Permit2 binds the spender, which is the settlement address).
 */
export function hashIntent(intent: Intent, domain: IntentDomain): Hex {
  assertDomain(domain);
  return intentStructHash(intent);
}

function witnessMessage(intent: Intent): Record<string, unknown> {
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

/** Decimal strings, because `@ethersproject` rejects bare `bigint`. */
function witnessForSdk(intent: Intent): Record<string, unknown> {
  return {
    ...witnessMessage(intent),
    amountIn: intent.amountIn.toString(),
    baseOut: intent.baseOut.toString(),
    hardMinOut: intent.hardMinOut.toString(),
    nonce: intent.nonce.toString(),
  };
}

export function permit2TypedData(args: {
  intent: Intent;
  permit2: Address;
  settlement: Address;
  chainId: number;
}): Permit2TypedData {
  if (args.chainId <= 0) {
    throw new Error("BadParams");
  }
  return {
    domain: {
      name: "Permit2",
      chainId: args.chainId,
      verifyingContract: args.permit2,
    },
    types: PERMIT_TYPES,
    primaryType: "PermitWitnessTransferFrom",
    message: {
      permitted: { token: args.intent.tokenIn, amount: args.intent.amountIn },
      spender: args.settlement,
      nonce: args.intent.nonce,
      deadline: BigInt(args.intent.deadline),
      witness: witnessMessage(args.intent),
    },
    witnessTypeString: WITNESS_TYPE_STRING,
  };
}

/** Digest Permit2 would recover, using the same witness type string the settlement contract passes. */
export function permit2Digest(args: {
  intent: Intent;
  permit2: Address;
  settlement: Address;
  chainId: number;
}): Hex {
  const data = permit2TypedData(args);
  const typeHash = keccak256(encodePacked(["string", "string"], [PERMIT_WITNESS_STUB, data.witnessTypeString]));
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
      [typeHash, tokenPermissionsHash, args.settlement, args.intent.nonce, BigInt(args.intent.deadline), intentStructHash(args.intent)],
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
        args.permit2,
      ],
    ),
  );
  return keccak256(encodePacked(["bytes2", "bytes32", "bytes32"], ["0x1901", domainSeparator, structHash]));
}

/** `@uniswap/permit2-sdk` digest for the same intent. Tests use this as the oracle. */
export function permit2SdkDigest(args: {
  intent: Intent;
  permit2: Address;
  settlement: Address;
  chainId: number;
}): Hex {
  const hash = SignatureTransfer.hash(
    {
      permitted: { token: args.intent.tokenIn, amount: args.intent.amountIn.toString() },
      spender: args.settlement,
      nonce: args.intent.nonce.toString(),
      deadline: args.intent.deadline.toString(),
    },
    args.permit2,
    args.chainId,
    {
      witness: witnessForSdk(args.intent),
      witnessTypeName: "Intent",
      witnessType: { Intent: [...INTENT_FIELDS] },
    },
  );
  return hash as Hex;
}

export async function verifyIntentSignature(args: {
  intent: Intent;
  signature: Hex;
  permit2: Address;
  settlement: Address;
  chainId: number;
}): Promise<boolean> {
  const data = permit2TypedData(args);
  return verifyTypedData({
    address: args.intent.maker,
    domain: data.domain,
    types: data.types,
    primaryType: data.primaryType,
    message: data.message,
    signature: args.signature,
  });
}
