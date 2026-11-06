import React from "react";
import type { ReactNode } from "react";
import { testIds } from "../../testids.ts";
import { Button } from "./Button.tsx";

export type BannerKind = "info" | "warn" | "error" | "success";

export function Banner({
  kind,
  children,
  actionLabel,
  onAction,
}: {
  kind: BannerKind;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const role = kind === "error" || kind === "warn" ? "alert" : "status";
  return (
    <div data-testid={testIds.banner} role={role}>
      <p>{children}</p>
      {actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}
