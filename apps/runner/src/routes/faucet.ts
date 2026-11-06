import type { Hono } from "hono";
import { handlers } from "../handlers/index.ts";
import type { FaucetRequest } from "../handlers/types.ts";
import { json } from "../middleware/http.ts";
import { mapError, readJsonBody } from "./errors.ts";
import { schemas } from "./schema.ts";

export function registerFaucet(app: Hono): void {
  app.post("/api/faucet", async (c) => {
    try {
      const body = await readJsonBody(c.req.raw);
      const parsed = schemas.FaucetRequest.safeParse(body);
      if (!parsed.success) return mapError(parsed.error);
      const result = await handlers.faucet(parsed.data as FaucetRequest);
      return json(result, 200);
    } catch (err) {
      return mapError(err);
    }
  });
}
