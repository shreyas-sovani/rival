import type { ReceiptVM } from "../../viewmodels/receipt.ts";
import { testIds } from "../../testids.ts";
import { Stat } from "../ui/Stat.tsx";
import { TxLink } from "./TxLink.tsx";

export function ReceiptView({ receipt }: { receipt: ReceiptVM }) {
  return (
    <article data-testid={testIds.receipt}>
      <h2>Receipt</h2>
      <Stat label="Intent" value={receipt.intentHash} />
      <Stat label="Amount in" value={receipt.amountIn} />
      <Stat label="Amount out" value={receipt.amountOut} />
      <Stat label="Curve bps" value={receipt.curveBps} />
      <Stat label="Fair out" value={receipt.fairOut} />
      <Stat label="Fair out after fee" value={receipt.fairOutAfterFee} />
      <Stat label="Improvement" value={receipt.improvementBps} />
      <Stat label="Elapsed" value={receipt.elapsed} />
      <Stat label="Solver" value={receipt.solverName} />
      <p>{receipt.poolDirectAtSign}</p>
      <TxLink link={receipt.tx} />
      {receipt.solverLink ? <TxLink link={receipt.solverLink} /> : null}
      {receipt.entity ? <TxLink link={receipt.entity} /> : null}
    </article>
  );
}
