import type { PresenceVM } from "../../viewmodels/common.ts";
import { testIds } from "../../testids.ts";
import { Chip } from "../ui/Chip.tsx";

export function PresenceChip({ presence }: { presence: PresenceVM }) {
  const label = presence.degraded ? `${presence.count} solvers (degraded feed)` : `${presence.count} solvers online`;
  return (
    <span data-testid={testIds.presenceChip}>
      <Chip>{label}</Chip>
      <span>
        {presence.pair}
        {presence.names.length > 0 ? ` · ${presence.names.join(", ")}` : ""}
      </span>
    </span>
  );
}
