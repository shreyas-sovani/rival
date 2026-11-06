import type { BookVM } from "../../viewmodels/book.ts";
import { testIds } from "../../testids.ts";
import { CopyButton } from "../ui/CopyButton.tsx";
import { EmptyState } from "../ui/EmptyState.tsx";
import { ErrorState } from "../ui/ErrorState.tsx";
import { Table } from "../ui/Table.tsx";
import { StatusBanner } from "./StatusBanner.tsx";
import { TxLink } from "./TxLink.tsx";

export function BookView({ vm }: { vm: BookVM }) {
  return (
    <section data-testid={testIds.book}>
      <h1>Book</h1>
      {vm.banner?.kind === "error" ? <ErrorState title={vm.banner.text} /> : null}
      {vm.banner ? <StatusBanner banner={vm.banner} /> : null}
      <pre>{vm.query}</pre>
      <CopyButton label="Copy query" value={vm.query} />
      <button onClick={vm.onCopyQuery} type="button">
        Copy via page
      </button>
      <p>
        {vm.count} · page {vm.page}
      </p>
      {vm.empty ? <EmptyState title="No intents" /> : null}
      {vm.empty ? null : (
        <Table caption="Intents">
          <thead>
            <tr>
              <th scope="col">Intent</th>
              <th scope="col">Pair</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {vm.rows.map((row) => (
              <tr key={row.intentHash}>
                <td>
                  {row.intentHash} {row.maker}
                </td>
                <td>
                  {row.pair} {row.amountIn} {row.mode} {row.gate}
                  {row.floor ? ` floor ${row.floor}` : ""}
                </td>
                <td>
                  {row.status} {row.chainStatus} {row.signatureOk ? "signature ok" : "signature failed"} {row.deadline}
                  {row.fillLink ? <TxLink link={row.fillLink} /> : null}
                  {row.entityLink ? <TxLink link={row.entityLink} /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}
