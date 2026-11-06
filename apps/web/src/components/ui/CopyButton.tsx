import React from "react";
import { useState } from "react";
import { testIds } from "../../testids.ts";
import { Button } from "./Button.tsx";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      data-testid={testIds.copyButton}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => setCopied(true));
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}
