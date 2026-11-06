import type { TxLinkVM } from "./common";

/** Fields match the `Filled` event, already formatted. */
export interface ReceiptVM {
  intentHash: string;
  amountIn: string;
  amountOut: string;
  curveBps: string;
  fairOut: string;
  fairOutAfterFee: string;
  improvementBps: string;
  elapsed: string;
  solverName: string;
  solverLink?: TxLinkVM;
  tx: TxLinkVM;
  /** "Pool A direct swap at signing time would have returned X", already formatted. */
  poolDirectAtSign: string;
  entity?: TxLinkVM;
}
