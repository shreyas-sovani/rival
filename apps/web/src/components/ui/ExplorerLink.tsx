import React from "react";
import { testIds } from "../../testids.ts";

export function ExplorerLink({
  chain,
  kind,
  value,
  href,
}: {
  chain: "sepolia" | "rabdi";
  kind: "tx" | "address";
  value: string;
  href?: string;
}) {
  const text = `${chain} ${kind} ${value}`;
  if (!href) return <span data-testid={testIds.explorerLink}>{text}</span>;
  return (
    <a data-testid={testIds.explorerLink} href={href} rel="noreferrer">
      {text}
    </a>
  );
}
