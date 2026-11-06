import { encodeFunctionData, parseAbi } from "viem";
import type { Address, Hex, Intent } from "./types.ts";
import { intentStructHash } from "./witness.ts";

/**
 * `RivalSettlement.fill` argument order from `IRivalSettlement`.
 * Tuple fields follow `Intent` and `FillParams` in `Types.sol` (enums as `uint8`).
 */
export const FILL_ABI = parseAbi([
  "function fill((address maker, address tokenIn, address tokenOut, uint128 amountIn, address recipient, uint8 mode, uint128 baseOut, uint32 oracleWindow, int32 startBps, int32 floorBps, uint32 startTime, uint32 decaySecs, uint32 deadline, uint128 hardMinOut, uint8 gate, bytes32 allowlistHash, uint256 nonce) i, bytes makerSig, (address inputTo, bool useCallback, bytes data, bytes32[] allowLabels) p)",
]);

/** Solver-supplied `fill` parameters. Not signed by the maker. */
export interface FillParams {
  inputTo: Address;
  useCallback: boolean;
  data: Hex;
  allowLabels: readonly Hex[];
}

export interface EncodedFill {
  calldata: Hex;
  intentHash: Hex;
}

/** Calldata for `RivalSettlement.fill`, plus the witness struct hash of `intent`. Builds bytes only. */
export function encodeFill(intent: Intent, signature: Hex, params: FillParams): EncodedFill {
  return {
    calldata: encodeFunctionData({
      abi: FILL_ABI,
      functionName: "fill",
      args: [intent, signature, params],
    }),
    intentHash: intentStructHash(intent),
  };
}
