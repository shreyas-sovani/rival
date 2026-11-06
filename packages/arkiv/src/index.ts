/** Scaffold marker. Schemas live in schemas.ts (MASTER). Do not delete this file. */
export const SCAFFOLD = true;

export { createArkivClients, type ArkivClientOptions } from "./client.ts";
export {
  publishIntent,
  queryOpenIntents,
  countPresence,
  upsertPresence,
  patchStatus,
  type PresenceInput,
  type PublishIntentInput,
  type QueryOpenIntentsArgs,
  type StatusPatch,
} from "./book.ts";
export {
  assertPayloadSize,
  encodeIntentPayload,
  verifyPayload,
  type IntentWitnessContext,
  type SignedIntentBody,
  type VerifiedIntentPayload,
} from "./payload.ts";
export {
  assertPageSize,
  buildIntentQuery,
  buildPresenceQuery,
  MAX_PAGE_SIZE,
  type IntentQueryArgs,
} from "./queries.ts";
export {
  INTENT_SCHEMA,
  IntentEntity,
  MAX_PAYLOAD_BYTES,
  MAX_STRING_BYTES,
  PAIR,
  PRESENCE_SCHEMA,
  SolverPresence,
} from "./schemas.ts";
