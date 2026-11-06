import type { EventVM } from "../../viewmodels/common.ts";
import { testIds } from "../../testids.ts";
import { EmptyState } from "../ui/EmptyState.tsx";
import { TxLink } from "./TxLink.tsx";

export function EventStreamView({ events }: { events: readonly EventVM[] }) {
  if (events.length === 0) return <EmptyState title="No events" />;
  return (
    <ol data-testid={testIds.eventStream}>
      {events.map((event) => (
        <li key={event.id}>
          <time dateTime={event.at}>{event.at}</time> {event.text}
          {event.link ? <TxLink link={event.link} /> : null}
        </li>
      ))}
    </ol>
  );
}
