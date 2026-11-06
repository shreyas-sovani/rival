export interface SseEvent {
  event: string;
  data: unknown;
}

export interface SseMessage {
  event: string;
  data: string;
}

export interface SseBus {
  publish(event: SseEvent): void;
  subscribe(signal?: AbortSignal): AsyncIterable<SseMessage>;
  close(): void;
}

export function formatSse(message: SseMessage): string {
  const lines = message.data.split("\n").map((line) => `data: ${line}`);
  return `event: ${message.event}\n${lines.join("\n")}\n\n`;
}

export function createSseBus(): SseBus {
  const listeners = new Set<(message: SseMessage) => void>();
  const ends = new Set<() => void>();
  let closed = false;

  const endAll = (): void => {
    if (closed) return;
    closed = true;
    for (const end of [...ends]) end();
    ends.clear();
    listeners.clear();
  };

  return {
    publish(event) {
      if (closed) return;
      const data = typeof event.data === "string" ? event.data : JSON.stringify(event.data);
      const message = { event: event.event, data };
      for (const listener of [...listeners]) listener(message);
    },
    subscribe(signal) {
      const queue: SseMessage[] = [];
      let waiter: ((message: SseMessage | null) => void) | null = null;
      let done = false;

      const finish = (): void => {
        if (done) return;
        done = true;
        listeners.delete(onMessage);
        ends.delete(finish);
        signal?.removeEventListener("abort", finish);
        const pending = waiter;
        waiter = null;
        pending?.(null);
      };

      const onMessage = (message: SseMessage): void => {
        if (done) return;
        if (waiter) {
          const pending = waiter;
          waiter = null;
          pending(message);
          return;
        }
        queue.push(message);
      };

      listeners.add(onMessage);
      ends.add(finish);
      if (closed || signal?.aborted) finish();
      else signal?.addEventListener("abort", finish);

      return {
        async *[Symbol.asyncIterator]() {
          try {
            for (;;) {
              const queued = queue.shift();
              if (queued) {
                yield queued;
                continue;
              }
              if (done) return;
              const next = await new Promise<SseMessage | null>((resolve) => {
                waiter = resolve;
              });
              if (next === null) return;
              yield next;
            }
          } finally {
            finish();
          }
        },
      };
    },
    close() {
      endAll();
    },
  };
}

const shared = createSseBus();

/** Process-wide bus. Each HTTP stream uses `createSseBus` so clients do not share a cursor. */
export function publish(event: SseEvent): void {
  shared.publish(event);
}

export function subscribe(signal?: AbortSignal): AsyncIterable<SseMessage> {
  return shared.subscribe(signal);
}
