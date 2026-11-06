import { describe, expect, it } from "vitest";
import { quoteCost } from "./quote.ts";

const base = {
  quoteOut: 1_000_000n,
  gasUnits: 100_000n,
  gasPriceWei: 1_000_000_000n,
  tokenOutPerEth: 3_000_000_000n,
};

describe("quoteCost", () => {
  it("is non-decreasing in the quote and non-increasing in gas", () => {
    const net = quoteCost(base);
    expect(net).toBe(700_000n);
    expect(quoteCost({ ...base, quoteOut: base.quoteOut + 1n })).toBe(net + 1n);

    let previousGas = quoteCost({ ...base, gasUnits: 0n });
    for (const gasUnits of [1n, 1_000n, 50_000n, 100_000n, 200_000n]) {
      const next = quoteCost({ ...base, gasUnits });
      expect(next).toBeLessThanOrEqual(previousGas);
      previousGas = next;
    }
    expect(quoteCost({ ...base, gasUnits: base.gasUnits * 2n })).toBeLessThan(net);

    let previousPrice = net;
    for (const gasPriceWei of [base.gasPriceWei + 1n, base.gasPriceWei * 2n, base.gasPriceWei * 3n]) {
      const next = quoteCost({ ...base, gasPriceWei });
      expect(next).toBeLessThanOrEqual(previousPrice);
      previousPrice = next;
    }
    expect(quoteCost({ ...base, gasPriceWei: base.gasPriceWei * 2n })).toBeLessThan(net);

    let previousRate = net;
    for (const tokenOutPerEth of [base.tokenOutPerEth + 1n, base.tokenOutPerEth * 2n]) {
      const next = quoteCost({ ...base, tokenOutPerEth });
      expect(next).toBeLessThanOrEqual(previousRate);
      previousRate = next;
    }
    expect(quoteCost({ ...base, tokenOutPerEth: base.tokenOutPerEth * 2n })).toBeLessThan(net);
  });
});
