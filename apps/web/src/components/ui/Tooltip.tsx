import React from "react";
import type { ReactNode } from "react";
import { testIds } from "../../testids.ts";

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = "tooltip-body";
  return (
    <span data-testid={testIds.tooltip}>
      <button aria-describedby={id} type="button">
        {children}
      </button>
      <span id={id} role="tooltip">
        {label}
      </span>
    </span>
  );
}
