import React from "react";
import { testIds } from "../../testids.ts";

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <p data-testid={testIds.stat}>
      <span>{label}</span> <strong>{value}</strong>
    </p>
  );
}
