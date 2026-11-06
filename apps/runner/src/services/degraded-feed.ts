import type { IntentStreamData } from "../handlers/types.ts";

interface Waiter {
  done: Promise<boolean>;
  cancel: () => void;
}

/** Intents accepted while Arkiv refused the write. Not the Arkiv book. */
export class DegradedFeed {
  private readonly items: IntentStreamData[] = [];
  private readonly listeners = new Set<() => void>();

  push(item: IntentStreamData): void {
    this.items.push(item);
    for (const listener of [...this.listeners]) listener();
  }

  /** Intents parked while Arkiv refused the write. */
  snapshot(): IntentStreamData[] {
    return [...this.items];
  }

  listen(signal?: AbortSignal): AsyncIterable<IntentStreamData> {
    return this.iterate(signal);
  }

  private async *iterate(signal?: AbortSignal): AsyncGenerator<IntentStreamData> {
    if (signal?.aborted) return;
    let cursor = 0;
    let pending: Waiter | null = null;
    try {
      for (;;) {
        while (cursor < this.items.length) {
          if (signal?.aborted) return;
          const item = this.items[cursor];
          cursor += 1;
          if (item) yield item;
        }
        if (signal?.aborted) return;
        const waiter = this.wait(signal, () => cursor < this.items.length);
        pending = waiter;
        const aborted = await waiter.done;
        pending = null;
        if (aborted) return;
      }
    } finally {
      pending?.cancel();
    }
  }

  private wait(signal: AbortSignal | undefined, ready: () => boolean): Waiter {
    let cancel = (): void => {};
    const done = new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (aborted: boolean): void => {
        if (settled) return;
        settled = true;
        this.listeners.delete(onData);
        signal?.removeEventListener("abort", onAbort);
        resolve(aborted);
      };
      const onData = (): void => {
        finish(false);
      };
      const onAbort = (): void => {
        finish(true);
      };
      cancel = () => {
        finish(true);
      };
      if (signal?.aborted) {
        finish(true);
        return;
      }
      this.listeners.add(onData);
      signal?.addEventListener("abort", onAbort);
      if (signal?.aborted) finish(true);
      else if (ready()) finish(false);
    });
    return { done, cancel };
  }
}
