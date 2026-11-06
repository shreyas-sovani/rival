import type { RunSolverVM } from "../../viewmodels/run-solver.ts";
import { testIds } from "../../testids.ts";
import { ErrorState } from "../ui/ErrorState.tsx";
import { Stat } from "../ui/Stat.tsx";
import { PresenceChip } from "./PresenceChip.tsx";
import { StatusBanner } from "./StatusBanner.tsx";

export function RunSolverView({ vm }: { vm: RunSolverVM }) {
  return (
    <section data-testid={testIds.runSolver}>
      <h1>Run a solver</h1>
      {vm.banner?.kind === "error" ? <ErrorState title={vm.banner.text} /> : null}
      {vm.banner ? <StatusBanner banner={vm.banner} /> : null}
      <ol>
        {vm.steps.map((step) => (
          <li key={step.n}>
            <h2>
              {step.n}. {step.title}
            </h2>
            <p>{step.body}</p>
            {step.command ? <pre>{step.command}</pre> : null}
          </li>
        ))}
      </ol>
      <pre>{vm.initCommand}</pre>
      <pre>{vm.devCommand}</pre>
      <Stat label="Label" value={vm.label} />
      <Stat label="Listed" value={vm.listed ? "yes" : "no"} />
      <Stat label="Last fill" value={vm.lastFill} />
      <PresenceChip presence={vm.presence} />
    </section>
  );
}
