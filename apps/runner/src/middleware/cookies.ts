import type { MiddlewareHandler } from "hono";

/** The runner API sets no cookies. */
export function stripCookies(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    c.res.headers.delete("set-cookie");
  };
}
