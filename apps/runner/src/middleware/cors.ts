import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";

/** Browser CORS is the single `ALLOWED_ORIGIN` value. Other origins get no allow header. */
export function corsMiddleware(allowedOrigin: string): MiddlewareHandler {
  return cors({
    origin: (origin) => (origin === allowedOrigin ? allowedOrigin : null),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Accept"],
    credentials: false,
    maxAge: 600,
  });
}
