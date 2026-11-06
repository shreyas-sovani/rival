import React from "react";
import type { ReactNode } from "react";
import { testIds } from "../../testids.ts";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div data-testid={testIds.emptyState} role="status">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
