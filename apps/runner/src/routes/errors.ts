import { ZodError } from "zod";
import { ApiError, NotImplemented } from "../handlers/types.ts";
import { logger } from "../logger.ts";
import { json } from "../middleware/http.ts";

const MAX_BODY_CHARS = 32_768;

export class RequestInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestInvalid";
  }
}

export function zodMessage(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

export function mapError(err: unknown): Response {
  if (err instanceof ZodError) {
    return json({ code: "INVALID_PARAMS", message: zodMessage(err) }, 400);
  }
  if (err instanceof ApiError) {
    return json({ code: err.code, message: err.message }, err.status);
  }
  if (err instanceof NotImplemented) {
    return json({ code: err.code, message: err.message }, err.status);
  }
  if (err instanceof RequestInvalid) {
    return json({ code: "INVALID_PARAMS", message: err.message }, 400);
  }
  if (err instanceof SyntaxError) {
    return json({ code: "INVALID_PARAMS", message: "body is not json" }, 400);
  }
  const message = err instanceof Error ? err.message : "request failed";
  logger.error({ name: err instanceof Error ? err.name : "Error" }, message);
  return json({ message: "internal error" }, 500);
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) {
    throw new RequestInvalid("body is too large");
  }
  if (text.trim() === "") {
    throw new RequestInvalid("body is empty");
  }
  return JSON.parse(text) as unknown;
}
