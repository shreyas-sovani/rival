export type RetryOptions = {
  retries: number;
  baseMs: number;
  maxMs: number;
  jitter: boolean;
  isRetryable: (error: unknown) => boolean;
};

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= options.retries || !options.isRetryable(error)) throw error;
      const exp = Math.min(options.maxMs, options.baseMs * 2 ** attempt);
      const wait = options.jitter ? Math.floor(exp * (0.5 + Math.random() * 0.5)) : exp;
      await delayMs(wait);
      attempt += 1;
    }
  }
}
