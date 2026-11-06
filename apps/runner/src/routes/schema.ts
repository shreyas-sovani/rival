import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fromJSONSchema, type ZodType } from "zod";

const API_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../../../specs/runner-api.json");

interface OpenApiDocument {
  components: {
    schemas: Record<string, unknown>;
  };
}

const document = JSON.parse(readFileSync(API_PATH, "utf8")) as OpenApiDocument;

const defs = JSON.parse(JSON.stringify(document.components.schemas).replaceAll('"#/components/schemas/', '"#/$defs/')) as Record<
  string,
  unknown
>;

function component(name: string): ZodType {
  const schema: unknown = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $ref: `#/$defs/${name}`,
    $defs: defs,
  };
  return fromJSONSchema(schema as Parameters<typeof fromJSONSchema>[0]);
}

/** Request and response schemas derived from `specs/runner-api.json`. */
export const schemas = {
  Health: component("Health"),
  FaucetRequest: component("FaucetRequest"),
  FaucetResponse: component("FaucetResponse"),
  IntentsRequest: component("IntentsRequest"),
  IntentsResponse: component("IntentsResponse"),
  CancelRequest: component("CancelRequest"),
  CancelResponse: component("CancelResponse"),
  IntentStreamData: component("IntentStreamData"),
  BookResponse: component("BookResponse"),
  ErrorBody: component("ErrorBody"),
  NotImplementedBody: component("NotImplementedBody"),
};
