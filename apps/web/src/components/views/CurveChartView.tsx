import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { CurveChartVM } from "../../viewmodels/curve.ts";
import { testIds } from "../../testids.ts";
import { EmptyState } from "../ui/EmptyState.tsx";
import { Skeleton } from "../ui/Skeleton.tsx";
import { Stat } from "../ui/Stat.tsx";

function scale(value: string): number | null {
  const match = /^[+-]?\d+(?:\.\d+)?/.exec(value.trim());
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function CurveChartView({ curve }: { curve: CurveChartVM }) {
  if (curve.empty) return <EmptyState title="No curve">The series is empty.</EmptyState>;
  const points = curve.requiredOut.flatMap((point) => {
    const y = scale(point.value);
    return y === null ? [] : [{ tSec: point.tSec, y }];
  });
  return (
    <figure data-testid={testIds.curveChart}>
      {points.length === 0 ? <Skeleton label="Curve series" /> : null}
      {points.length > 0 ? (
        <ResponsiveContainer height={220} width="100%">
          <LineChart data={points}>
            <XAxis dataKey="tSec" />
            <YAxis />
            <Line dataKey="y" dot={false} name={curve.yUnit} stroke="currentColor" type="monotone" />
          </LineChart>
        </ResponsiveContainer>
      ) : null}
      <figcaption>
        <Stat label={curve.poolQuote.label} value={curve.poolQuote.value} />
        <Stat label={curve.twap.label} value={curve.twap.value} />
        <Stat label={curve.hardFloor.label} value={curve.hardFloor.value} />
        {curve.fill ? <Stat label={curve.fill.label} value={curve.fill.value} /> : null}
      </figcaption>
      <ul>
        {curve.requiredOut.map((point) => (
          <li key={`${point.tSec}-${point.value}`}>
            {point.tSec}s · {point.value}
          </li>
        ))}
      </ul>
    </figure>
  );
}
