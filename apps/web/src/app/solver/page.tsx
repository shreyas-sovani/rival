import { PAIR } from "@rival/arkiv";
import { RunSolverView } from "../../components/views/RunSolverView.tsx";
import { RUN_A_SOLVER_STEPS, SOLVER_DEV_COMMAND, SOLVER_INIT_COMMAND } from "../../content/run-a-solver.ts";
import type { BannerVM } from "../../viewmodels/common.ts";
import type { RunSolverVM } from "../../viewmodels/run-solver.ts";
import { routes } from "../../viewmodels/routes.ts";
import { RouteShell } from "./page.shell.tsx";

const statusBanner: BannerVM = {
  kind: "warn",
  text: "Live solver status is unavailable. Presence, listing, and last fill cannot be read.",
};

function routeTitle(path: (typeof routes)[number]["path"]): string {
  return routes.find((route) => route.path === path)?.title ?? path;
}

const vm: RunSolverVM = {
  steps: RUN_A_SOLVER_STEPS.map((step) => ({
    n: step.n,
    title: step.title,
    body: step.body,
    ...(step.command ? { command: step.command } : {}),
  })),
  initCommand: SOLVER_INIT_COMMAND,
  devCommand: SOLVER_DEV_COMMAND,
  label: "unavailable",
  listed: false,
  presence: { count: "0", pair: PAIR, degraded: true, names: [] },
  lastFill: "unavailable",
  banner: statusBanner,
};

export default function SolverPage() {
  return (
    <RouteShell title={routeTitle("/solver")}>
      <RunSolverView vm={vm} />
    </RouteShell>
  );
}
