import type { Hono } from "hono";
import { handlers } from "../handlers/index.ts";
import { mapError } from "./errors.ts";
import { createSseBus, formatSse, type SseMessage } from "../sse.ts";

function sseResponse(source: AsyncIterable<SseMessage>): Response {
  const encoder = new TextEncoder();
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const message of source) {
          controller.enqueue(encoder.encode(formatSse(message)));
        }
      } catch {
        // The client aborted the subscription.
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // The stream is already closed.
          }
        }
      }
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}

export function registerStream(app: Hono): void {
  app.get("/api/intents/stream", async (c) => {
    const signal = c.req.raw.signal;
    try {
      const source = await handlers.stream({ signal });
      const bus = createSseBus();
      const subscription = bus.subscribe(signal);
      const forward = (async () => {
        try {
          for await (const item of source) {
            if (signal.aborted) return;
            bus.publish({ event: "intent", data: item });
          }
        } finally {
          bus.close();
        }
      })();
      void forward.catch(() => {
        bus.close();
      });
      signal.addEventListener("abort", () => {
        bus.close();
      });
      return sseResponse(subscription);
    } catch (err) {
      return mapError(err);
    }
  });
}
