import type { BannerVM, EventVM } from "./common";
import type { CurveChartVM } from "./curve";
import type { ReceiptVM } from "./receipt";

export type AuctionPhase = "waiting" | "live" | "filled" | "cancelled" | "expired" | "missing";

export interface AuctionStatusVM {
  intentHash: string;
  phase: AuctionPhase;
  phaseLabel: string;
  curve: CurveChartVM;
  events: EventVM[];
  receipt?: ReceiptVM;
  canCancel: boolean;
  banner?: BannerVM;
  onCancel: () => void;
}
