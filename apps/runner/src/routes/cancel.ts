import type { Hono } from "hono";
import { handlers } from "../handlers/index.ts";
import type { CancelRequest } from "../handlers/types.ts";
import { json } from "../middleware/http.ts";
import { mapError, readJsonBody } from "./errors.ts";
import { schemas } from "./schema.ts";

export function registerCancel(app: Hono): void {
  app.post("/api/cancel", async (c) => {
    try {
      const body = await readJsonBody(c.req.raw);
      const parsed = schemas.CancelRequest.safeParse(body);
      if (!parsed.success) return mapError(parsed.error);
      const result = await handlers.cancel(parsed.data as CancelRequest);
      return json(result, 200);
    } catch (err) {
      return mapError(err);
    }
  });
}
