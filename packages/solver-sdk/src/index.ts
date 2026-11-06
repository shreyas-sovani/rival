/** Scaffold marker. Later tasks add the real exports. Do not delete this file. */
export const SCAFFOLD = true;

export { listCandidates, netQuote, screenIntent } from "./adapters.ts";
export { outputCurve, ceilDiv, floorDiv } from "./curve.ts";
export { PRESENCE_INTERVAL_SEC, presenceHeartbeat } from "./heartbeat.ts";
export { INTENT_DOMAIN_NAME, INTENT_DOMAIN_VERSION, INTENT_FIELDS, INTENT_TYPE, intentDomain, intentTypedData } from "./intent-type.ts";
export { nonceManager } from "./nonce.ts";
export type { NonceManager } from "./nonce.ts";
export type { ArkivOpenBook, SettlementFacts, VenueQuoter } from "./ports.ts";
export { quoteCost } from "./quote.ts";
export { arb, house, inventory, patient, sprint } from "./strategies.ts";
export type { StrategyDecision, StrategyInput } from "./strategies.ts";
export { encodeFill, FILL_ABI } from "./fill.ts";
export type { EncodedFill, FillParams } from "./fill.ts";
export { createLiveSolverPorts, runSolverLoop, quoteAtSqrt, STATE_VIEW } from "./live.ts";
export type { LiveSolverInput, PoolRef } from "./live.ts";
export { createRpcPool } from "./rpc-pool.ts";
export type { RpcPoolOptions, RpcPoolStats } from "./rpc-pool.ts";
export { submitPlan } from "./submit.ts";
export type { Clock, SubmitSignals, SubmitSnapshot, SubmitState, SubmitStep } from "./submit.ts";
export type { Address, Gate, Hex, Intent, Mode } from "./types.ts";
export { getBook, watchIntents } from "./book.ts";
export type { BookQuery, BookResult, BookRow, WatchedIntent, WatchIntentsOpts } from "./book.ts";
export { runSolver } from "./config.ts";
export type { RunSolverDeps, SolverConfig } from "./config.ts";
export { initSolver } from "./init.ts";
export type { InitSolverClients, InitSolverResult } from "./init.ts";
export { signAndPublish } from "./publish.ts";
export type { SignAndPublishOpts, SignAndPublishResult } from "./publish.ts";
export { verifyFill } from "./verify-fill.ts";
export type { VerifyFillResult } from "./verify-fill.ts";
export type {
  FillPlan,
  PresencePort,
  RunSolverPorts,
  RunSolverResult,
  SettlementSubmitter,
  StrategyId,
} from "./run.ts";
export { readIntent, verifyIntent } from "./verify.ts";
export type { VerifyIntentArgs, VerifyIntentResult, VerifyReason } from "./verify.ts";
export { WITNESS_TYPE_STRING, intentStructHash, permit2WitnessDigest, permit2WitnessTypedData, verifyWitness } from "./witness.ts";
export type { Permit2WitnessArgs, WitnessVerdict } from "./witness.ts";
