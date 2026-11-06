import React from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { testIds } from "../../testids.ts";

export function Button({
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button data-testid={testIds.button} type={type} {...rest}>
      {children}
    </button>
  );
}
