import type { UnlockedWallet } from "../wallet/wallet.ts";

/**
 * Post a signed intent. The unlocked key is in scope so callers can prove it never
 * leaves the device: only the address, signature, and summary are serialized.
 */
export async function postSignedIntent(args: {
  endpoint: string;
  wallet: Pick<UnlockedWallet, "address" | "privateKey">;
  signature: string;
  summary: string;
}): Promise<void> {
  const url = new URL(args.endpoint);
  url.searchParams.set("maker", args.wallet.address);
  const body = JSON.stringify({
    address: args.wallet.address,
    signature: args.signature,
    summary: args.summary,
  });
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}
