import React from "react";
import { testIds } from "../../testids.ts";

export function Skeleton({ label }: { label: string }) {
  return (
    <div aria-hidden="true" data-testid={testIds.skeleton}>
      <span className="sr-only">{label}</span>
    </div>
  );
}
