import type { DegradedFeed } from "../services/degraded-feed.ts";
import type { IntentStreamData, StreamRequest } from "./types.ts";

export function stream(feed: DegradedFeed, req: StreamRequest): Promise<AsyncIterable<IntentStreamData>> {
  return Promise.resolve(feed.listen(req.signal));
}
