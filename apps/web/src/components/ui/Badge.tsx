import React from "react";
import type { ReactNode } from "react";
import { testIds } from "../../testids.ts";

export function Badge({ children }: { children: ReactNode }) {
  return <span data-testid={testIds.badge}>{children}</span>;
}
