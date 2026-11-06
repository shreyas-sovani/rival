import React from "react";
import { AddressText } from "./AddressText.tsx";
import { Badge } from "./Badge.tsx";
import { Banner } from "./Banner.tsx";
import { Button } from "./Button.tsx";
import { Card } from "./Card.tsx";
import { Chip } from "./Chip.tsx";
import { CopyButton } from "./CopyButton.tsx";
import { Dialog } from "./Dialog.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { ErrorState } from "./ErrorState.tsx";
import { ExplorerLink } from "./ExplorerLink.tsx";
import { Skeleton } from "./Skeleton.tsx";
import { Stat } from "./Stat.tsx";
import { Table } from "./Table.tsx";
import { Tabs } from "./Tabs.tsx";
import { TimeAgo } from "./TimeAgo.tsx";
import { Tooltip } from "./Tooltip.tsx";

/** Static catalog for the axe gate. Not a production route. */
export function PrimitivesCatalog() {
  return (
    <main>
      <h1>Primitives</h1>
      <Button>Continue</Button>
      <Card title="Card">Body</Card>
      <Badge>Open</Badge>
      <Chip>tWETH</Chip>
      <Banner kind="info">Testnet prototype.</Banner>
      <Banner actionLabel="Retry" kind="error" onAction={() => undefined}>
        Runner unavailable
      </Banner>
      <Table caption="Solvers">
        <thead>
          <tr>
            <th scope="col">Name</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>atlas</td>
          </tr>
        </tbody>
      </Table>
      <Tabs label="Examples" tabs={[{ id: "one", label: "One", panel: "Panel" }]} />
      <Dialog title="Details" trigger="Open details">
        Nothing hidden from the keyboard.
      </Dialog>
      <Tooltip label="Full hash">Hash</Tooltip>
      <Skeleton label="Loading row" />
      <CopyButton value="0xabc" />
      <ExplorerLink chain="sepolia" kind="tx" value="0xabc" />
      <AddressText value="0x0000000000000000000000000000000000000000" />
      <TimeAgo now={1_700_000_000_000} ts={1_700_000_000_000} />
      <Stat label="Fills" value="100" />
      <EmptyState title="No rows" />
      <ErrorState title="Could not load" />
    </main>
  );
}
