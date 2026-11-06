import type { Hono } from "hono";
import { handlers } from "../handlers/index.ts";
import { json } from "../middleware/http.ts";
import { mapError } from "./errors.ts";

export function registerHealth(app: Hono): void {
  app.get("/api/health", async () => {
    try {
      const body = await handlers.health({});
      const status = body.status === "ok" ? 200 : 503;
      return json(body, status);
    } catch (err) {
      return mapError(err);
    }
  });
}
