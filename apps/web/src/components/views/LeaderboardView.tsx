import type { LeaderboardVM } from "../../viewmodels/leaderboard.ts";
import { testIds } from "../../testids.ts";
import { AddressText } from "../ui/AddressText.tsx";
import { Badge } from "../ui/Badge.tsx";
import { EmptyState } from "../ui/EmptyState.tsx";
import { ErrorState } from "../ui/ErrorState.tsx";
import { Table } from "../ui/Table.tsx";
import { StatusBanner } from "./StatusBanner.tsx";
import { TxLink } from "./TxLink.tsx";

export function LeaderboardView({ vm }: { vm: LeaderboardVM }) {
  if (vm.empty) {
    return (
      <section data-testid={testIds.leaderboard}>
        {vm.banner ? <StatusBanner banner={vm.banner} /> : null}
        <EmptyState title="No solvers" />
      </section>
    );
  }
  return (
    <section data-testid={testIds.leaderboard}>
      {vm.banner?.kind === "error" ? <ErrorState title={vm.banner.text} /> : null}
      {vm.banner ? <StatusBanner banner={vm.banner} /> : null}
      <Table caption="Leaderboard">
        <thead>
          <tr>
            <th scope="col">Solver</th>
            <th scope="col">Fills</th>
            <th scope="col">Makers</th>
            <th scope="col">Improvement</th>
            <th scope="col">Last fill</th>
          </tr>
        </thead>
        <tbody>
          {vm.rows.map((row) => (
            <tr key={row.address}>
              <td>
                {row.label} <AddressText value={row.address} />
                {row.listed === undefined ? null : row.listed ? " listed" : " not listed"}
                {row.matchesEns ? <Badge>matches ENS</Badge> : null}
                {row.ensLink ? <TxLink link={row.ensLink} /> : null}
              </td>
              <td>{row.fills}</td>
              <td>{row.makers}</td>
              <td>{row.avgImprovement}</td>
              <td>
                {row.lastFill}
                {row.lastFillLink ? <TxLink link={row.lastFillLink} /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}
