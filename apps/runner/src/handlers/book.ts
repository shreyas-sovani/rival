import { PAIR } from "@rival/arkiv";
import type { DegradedFeed } from "../services/degraded-feed.ts";
import type { RunnerDeps } from "../services/deps.ts";
import { readOpenIntents, readPresence } from "../services/arkiv.ts";
import { chainConfig } from "../services/chain.ts";
import { pageEntities, rowFromEntity, type BookRow } from "../services/book-rows.ts";
import type { BookRequest, BookResponse } from "./types.ts";

const PAIR_DEFAULT = PAIR;

function feedRows(feed: DegradedFeed): BookRow[] {
  return feed.snapshot().flatMap((item) => {
    const mode = item.intent.mode;
    const gate = item.intent.gate;
    if ((mode !== 0 && mode !== 1) || (gate !== 0 && gate !== 1 && gate !== 2)) return [];
    return [
      {
        intentHash: item.intentHash,
        maker: item.intent.maker,
        pair: PAIR_DEFAULT,
        amountIn: item.intent.amountIn,
        mode,
        gate,
        status: "open" as const,
        deadline: item.intent.deadline,
        signatureOk: true,
        chainStatus: "unknown" as const,
        floor: item.intent.hardMinOut,
      },
    ];
  });
}

/** Open book plus presence. An Arkiv failure returns the degraded feed and HTTP 200. */
export async function book(deps: RunnerDeps, feed: DegradedFeed, req: BookRequest): Promise<BookResponse> {
  const pair = req.pair && req.pair.trim() !== "" ? req.pair : PAIR_DEFAULT;
  const status = req.status && req.status.trim() !== "" ? req.status : "open";
  const asOf = deps.clock();
  const chain = chainConfig();
  let failed = false;
  let rows: BookRow[] | undefined;
  let presence: number | undefined;
  try {
    const page = await readOpenIntents(pair, status, asOf);
    const mapped = await Promise.all(
      pageEntities(page).map((entity) =>
        rowFromEntity(entity, {
          domain: deps.chain.domain,
          permit2: chain.permit2,
          settlement: chain.settlement,
          chainId: chain.chainId,
        }),
      ),
    );
    rows = mapped.filter((row): row is BookRow => row !== undefined);
  } catch {
    failed = true;
  }
  try {
    presence = await readPresence(pair);
  } catch {
    failed = true;
  }
  if (failed) {
    return {
      rows: rows ?? feedRows(feed),
      presence: presence ?? 0,
      asOf,
      source: "degraded",
    };
  }
  return {
    rows: rows ?? [],
    presence: presence ?? 0,
    asOf,
    source: "arkiv",
  };
}
