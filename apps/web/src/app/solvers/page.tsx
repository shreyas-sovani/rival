import { LeaderboardView } from "../../components/views/LeaderboardView.tsx";
import { Banner } from "../../components/ui/Banner.tsx";
import { toLeaderboardVM } from "../../data/leaderboard.ts";
import { routes } from "../../viewmodels/routes.ts";
import { RouteShell } from "./page.shell.tsx";

function routeTitle(path: (typeof routes)[number]["path"]): string {
  return routes.find((route) => route.path === path)?.title ?? path;
}

const vm = toLeaderboardVM({
  rows: [],
  banner: {
    kind: "warn",
    text: "Solver registry and ENS reads are unavailable.",
  },
});

export default function SolversPage() {
  return (
    <RouteShell title={routeTitle("/solvers")}>
      <Banner kind="warn">Solver registry and ENS reads are unavailable.</Banner>
      <LeaderboardView vm={vm} />
    </RouteShell>
  );
}
