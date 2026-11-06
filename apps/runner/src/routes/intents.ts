import type { Hono } from "hono";
import { handlers } from "../handlers/index.ts";
import type { IntentsRequest } from "../handlers/types.ts";
import { json } from "../middleware/http.ts";
import { mapError, readJsonBody } from "./errors.ts";
import { schemas } from "./schema.ts";

export function registerIntents(app: Hono): void {
  app.post("/api/intents", async (c) => {
    try {
      const body = await readJsonBody(c.req.raw);
      const parsed = schemas.IntentsRequest.safeParse(body);
      if (!parsed.success) return mapError(parsed.error);
      const result = await handlers.intents(parsed.data as IntentsRequest);
      return json(result, 200);
    } catch (err) {
      return mapError(err);
    }
  });
}
