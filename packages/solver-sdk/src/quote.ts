const WEI_PER_ETH = 10n ** 18n;

export interface QuoteCostInput {
  quoteOut: bigint;
  gasUnits: bigint;
  gasPriceWei: bigint;
  /** tokenOut base units per 1 ETH (10^18 wei). */
  tokenOutPerEth: bigint;
}

/** Net of gas, in tokenOut base units. Gas converts at `tokenOutPerEth` per ETH. */
export function quoteCost(input: QuoteCostInput): bigint {
  if (input.gasUnits < 0n || input.gasPriceWei < 0n || input.tokenOutPerEth < 0n) {
    throw new Error("bad params");
  }
  const gasWei = input.gasUnits * input.gasPriceWei;
  const gasOut = (gasWei * input.tokenOutPerEth) / WEI_PER_ETH;
  return input.quoteOut - gasOut;
}
