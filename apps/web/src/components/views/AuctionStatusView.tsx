import type { AuctionStatusVM } from "../../viewmodels/auction.ts";
import { testIds } from "../../testids.ts";
import { Button } from "../ui/Button.tsx";
import { EmptyState } from "../ui/EmptyState.tsx";
import { ErrorState } from "../ui/ErrorState.tsx";
import { CurveChartView } from "./CurveChartView.tsx";
import { EventStreamView } from "./EventStreamView.tsx";
import { ReceiptView } from "./ReceiptView.tsx";
import { StatusBanner } from "./StatusBanner.tsx";

export function AuctionStatusView({ vm }: { vm: AuctionStatusVM }) {
  if (vm.phase === "missing") return <EmptyState title="Intent missing">{vm.phaseLabel}</EmptyState>;
  return (
    <section data-testid={testIds.auctionStatus}>
      <h1>{vm.phaseLabel}</h1>
      {vm.banner?.kind === "error" ? <ErrorState title={vm.banner.text} /> : null}
      {vm.banner ? <StatusBanner banner={vm.banner} /> : null}
      <p>{vm.intentHash}</p>
      <CurveChartView curve={vm.curve} />
      <EventStreamView events={vm.events} />
      {vm.receipt ? <ReceiptView receipt={vm.receipt} /> : null}
      <Button disabled={!vm.canCancel} onClick={vm.onCancel}>
        Cancel
      </Button>
    </section>
  );
}
