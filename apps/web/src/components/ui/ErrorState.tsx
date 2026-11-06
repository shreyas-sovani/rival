import React from "react";
import type { ReactNode } from "react";
import { testIds } from "../../testids.ts";

export function ErrorState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div data-testid={testIds.errorState} role="alert">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
