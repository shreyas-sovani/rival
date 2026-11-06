import React from "react";
import type { ReactNode } from "react";
import { testIds } from "../../testids.ts";

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section data-testid={testIds.card}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
