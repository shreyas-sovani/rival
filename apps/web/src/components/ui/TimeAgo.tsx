import React from "react";
import { relativeTime } from "../../lib/format.ts";
import { testIds } from "../../testids.ts";

export function TimeAgo({ ts, now }: { ts: number; now: number }) {
  const iso = Number.isFinite(ts) ? new Date(ts).toISOString() : undefined;
  return (
    <time data-testid={testIds.timeAgo} dateTime={iso}>
      {relativeTime(ts, now)}
    </time>
  );
}
