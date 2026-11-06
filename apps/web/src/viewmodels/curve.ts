export interface CurvePoint {
  /** Seconds after the intent's start time. Chart axis only; not a price input. */
  tSec: number;
  /** Formatted required output. */
  value: string;
}

export interface HorizontalLine {
  label: string;
  value: string;
}

/** Series the chart renders. No domain math in the view. */
export interface CurveChartVM {
  requiredOut: CurvePoint[];
  poolQuote: HorizontalLine;
  twap: HorizontalLine;
  hardFloor: HorizontalLine;
  fill?: { tSec: number; value: string; label: string };
  yUnit: string;
  empty: boolean;
}
