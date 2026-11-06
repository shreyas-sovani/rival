import { createPublicClient, createWalletClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { http, type Account } from "viem";
import { createRotatingFetch, stampKey, type FetchLike } from "./rotation.ts";

export type ArkivClientOptions = {
  readKeys: readonly string[];
  writeKey?: string;
  transport?: FetchLike;
};

export function createArkivClients(options: ArkivClientOptions) {
  const first = options.readKeys[0];
  if (first === undefined) throw new Error("readKeys required");
  const readKey: string = first;
  const base = options.transport ?? fetch;
  const read = createPublicClient({
    chain: rabdi({ accessKey: readKey }),
    transport: http(undefined, {
      fetchFn: createRotatingFetch(options.readKeys, base),
      retryCount: 0,
    }),
  });

  function wallet<account extends Account>(account: account) {
    const key = options.writeKey ?? readKey;
    const fetchFn: FetchLike = async (input, init) => {
      const stamped = stampKey(input, init, key, [key, ...options.readKeys]);
      return base(stamped.input, stamped.init);
    };
    return createWalletClient({
      account,
      chain: rabdi({ accessKey: key }),
      transport: http(undefined, { fetchFn, retryCount: 0 }),
    });
  }

  return { read, wallet };
}
