import React from "react";
import type { ReactNode } from "react";
import { testIds } from "../../testids.ts";

export function Table({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <table data-testid={testIds.table}>
      <caption>{caption}</caption>
      {children}
    </table>
  );
}
