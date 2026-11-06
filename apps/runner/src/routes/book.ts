import type { Hono } from "hono";
import { handlers } from "../handlers/index.ts";
import type { BookRequest } from "../handlers/types.ts";
import { json } from "../middleware/http.ts";
import { mapError } from "./errors.ts";

export function registerBook(app: Hono): void {
  app.get("/api/intents", async (c) => {
    try {
      const req: BookRequest = { pair: c.req.query("pair"), status: c.req.query("status") };
      const result = await handlers.book(req);
      return json(result, 200);
    } catch (err) {
      return mapError(err);
    }
  });
}
