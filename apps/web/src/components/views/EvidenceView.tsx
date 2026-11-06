import type { EvidenceVM } from "../../viewmodels/evidence.ts";
import { testIds } from "../../testids.ts";
import { Button } from "../ui/Button.tsx";
import { ErrorState } from "../ui/ErrorState.tsx";
import { Stat } from "../ui/Stat.tsx";
import { StatusBanner } from "./StatusBanner.tsx";
import { TxLink } from "./TxLink.tsx";

export function EvidenceView({ vm }: { vm: EvidenceVM }) {
  return (
    <section data-testid={testIds.evidence}>
      <h1>Evidence</h1>
      {vm.banner?.kind === "error" ? <ErrorState title={vm.banner.text} /> : null}
      {vm.banner ? <StatusBanner banner={vm.banner} /> : null}
      <Stat label="Commit" value={vm.commit} />
      <Stat label="Hook flags" value={vm.hookFlags} />
      <h2>Addresses</h2>
      <ul>
        {vm.addresses.map((row) => (
          <li key={row.label}>
            {row.label}: {row.value}
            {row.link ? <TxLink link={row.link} /> : null}
          </li>
        ))}
      </ul>
      <h2>Pools</h2>
      <ul>
        {vm.pools.map((row) => (
          <li key={row.label}>
            {row.label}: {row.value}
          </li>
        ))}
      </ul>
      <h2>ENS roles</h2>
      <ul>
        {vm.ensRoles.map((row) => (
          <li key={row.label}>
            {row.label}: {row.value}
          </li>
        ))}
      </ul>
      <h2>Queries</h2>
      {vm.queries.map((query) => (
        <pre key={query.title}>
          {query.title}
          {"\n"}
          {query.query}
        </pre>
      ))}
      <h2>Limitations</h2>
      <ul>
        {vm.limitations.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Button onClick={vm.onUnlistedFill}>Unlisted solver tries a gated fill</Button>
      <p>{vm.unlistedResult}</p>
      <Button onClick={vm.onForgeRecord}>Try to forge a track record</Button>
      <p>{vm.forgeResult}</p>
    </section>
  );
}
