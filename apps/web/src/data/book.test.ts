import { buildIntentQuery } from "@rival/arkiv";
import { describe, expect, it } from "vitest";
import { toBookVM } from "./book.ts";

describe("book adapter", () => {
  it("maps one injected Arkiv row into BookVM", () => {
    const queryArgs = {
      status: "open",
      pair: "tWETH/tUSDC",
      now: 1_700_000_000,
      sortDeadlineAsc: true,
    } as const;
    const deadline = Date.UTC(2026, 10, 6, 14, 32, 10) / 1000;
    const fillTx = `0x${"12".repeat(32)}`;
    const entityKey = `0x${"ab".repeat(32)}`;
    let copied = 0;
    const vm = toBookVM({
      queryArgs,
      onCopyQuery: () => {
        copied += 1;
      },
      rows: [
        {
          intentHash: `0x${"cd".repeat(32)}`,
          maker: "0x0000000000000000000000000000000000000001",
          pair: "tWETH/tUSDC",
          amountIn: 10n ** 18n,
          mode: 1,
          gate: 0,
          status: "open",
          deadline,
          signatureOk: true,
          chainStatus: "open",
          fillTx,
          entityKey,
        },
      ],
    });

    expect(vm.query).toBe(buildIntentQuery(queryArgs));
    expect(vm.count).toBe("1");
    expect(vm.page).toBe("1");
    expect(vm.empty).toBe(false);
    expect(vm.rows).toHaveLength(1);
    const row = vm.rows[0];
    if (!row) throw new Error("expected a book row");
    expect(row).toMatchObject({
      maker: "0x0000000000000000000000000000000000000001",
      pair: "tWETH/tUSDC",
      amountIn: "1",
      mode: "pegged",
      gate: "open",
      status: "open",
      deadline: "2026-11-06 14:32:10 UTC",
      signatureOk: true,
      chainStatus: "open",
    });
    expect(row.fillLink).toMatchObject({ chain: "sepolia", kind: "tx", value: fillTx });
    expect(row.entityLink).toMatchObject({ chain: "rabdi", kind: "entity", value: entityKey });
    vm.onCopyQuery();
    expect(copied).toBe(1);
  });
});
