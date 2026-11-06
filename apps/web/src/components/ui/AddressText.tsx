import React from "react";
import { getAddress } from "viem";
import { testIds } from "../../testids.ts";

function checksum(value: string): string {
  try {
    return getAddress(value);
  } catch {
    return value;
  }
}

export function AddressText({ value }: { value: string }) {
  const display = checksum(value);
  if (display.length <= 10) {
    return (
      <span data-testid={testIds.addressText} title={display}>
        {display}
      </span>
    );
  }
  return (
    <span data-testid={testIds.addressText} title={display}>
      <strong>{display.slice(0, 6)}</strong>
      {display.slice(6, -4)}
      <strong>{display.slice(-4)}</strong>
    </span>
  );
}
