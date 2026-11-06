import React from "react";
import type { ReactNode } from "react";
import { testIds } from "../../testids.ts";

export function Chip({ children, pressed, onClick }: { children: ReactNode; pressed?: boolean; onClick?: () => void }) {
  return (
    <button aria-pressed={pressed ?? false} data-testid={testIds.chip} onClick={onClick} type="button">
      {children}
    </button>
  );
}
