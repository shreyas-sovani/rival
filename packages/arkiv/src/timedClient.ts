import { createPublicClient, createWalletClient, type PublicArkivClient, type WalletArkivClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { formatEther, http, isHex, type Account, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

export { formatEther, isHex };

/** Per-request cap used by the S4 spike. */
export const RPC_TIMEOUT_MS = 20_000;

export function createTimedReadClient(readKey: string): PublicArkivClient {
  return createPublicClient({
    chain: rabdi({ accessKey: readKey }),
    transport: http(undefined, { timeout: RPC_TIMEOUT_MS, retryCount: 0 }),
  });
}

export function createTimedArkivClients(options: {
  readKey: string;
  writeKey: string;
  account: Account;
}): { read: PublicArkivClient; write: WalletArkivClient } {
  const transport = () => http(undefined, { timeout: RPC_TIMEOUT_MS, retryCount: 0 });
  const read = createPublicClient({
    chain: rabdi({ accessKey: options.readKey }),
    transport: transport(),
  });
  const write = createWalletClient({
    account: options.account,
    chain: rabdi({ accessKey: options.writeKey }),
    transport: transport(),
  });
  return { read, write };
}

export function accountFromPrivateKey(privateKey: Hex): PrivateKeyAccount {
  return privateKeyToAccount(privateKey);
}
