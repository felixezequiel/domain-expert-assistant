import { useState } from "react";
import { auditApi, type AuditFilter } from "../../api/resources.ts";
import type { AuditEventView } from "../../api/types.ts";
import { ErrorNotice, Loading } from "../../components/AsyncBoundary.tsx";

const DEFAULT_LIMIT = 100;

// Read-only audit trail (Auditor persona). Filters by aggregate / actor / event name /
// time window. The endpoint is auditor/admin-gated server-side; a 403 renders as
// "not permitted" via ErrorNotice.
export function AuditTrailPage(): JSX.Element {
  const [aggregateId, setAggregateId] = useState("");
  const [actorId, setActorId] = useState("");
  const [eventName, setEventName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [events, setEvents] = useState<ReadonlyArray<AuditEventView>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [searched, setSearched] = useState(false);

  const load = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const filter: AuditFilter = {
      limit: DEFAULT_LIMIT,
      ...(aggregateId !== "" ? { aggregateId } : {}),
      ...(actorId !== "" ? { actorId } : {}),
      ...(eventName !== "" ? { eventName } : {}),
      ...(from !== "" ? { from: new Date(from).toISOString() } : {}),
      ...(to !== "" ? { to: new Date(to).toISOString() } : {}),
    };
    try {
      const result = await auditApi.events(filter);
      setEvents(result.events);
      setSearched(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Audit trail</h2>
      <div className="filters">
        <input placeholder="Aggregate id" value={aggregateId} onChange={(event) => setAggregateId(event.target.value)} />
        <input placeholder="Actor id" value={actorId} onChange={(event) => setActorId(event.target.value)} />
        <input placeholder="Event name" value={eventName} onChange={(event) => setEventName(event.target.value)} />
        <input type="datetime-local" aria-label="From" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input type="datetime-local" aria-label="To" value={to} onChange={(event) => setTo(event.target.value)} />
        <button type="button" onClick={() => void load()}>
          Search
        </button>
      </div>

      {error !== null ? <ErrorNotice error={error} /> : null}
      {loading ? <Loading /> : null}

      {searched && !loading && error === null ? (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Event</th>
              <th>Aggregate</th>
              <th>Actor</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.eventId}>
                <td>{event.occurredAt}</td>
                <td>{event.eventName}</td>
                <td>
                  <code>{event.aggregateId}</code>
                </td>
                <td>{event.actorId ?? "—"}</td>
                <td>{event.actorType ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {searched && !loading && error === null && events.length === 0 ? (
        <p className="notice">No events match these filters.</p>
      ) : null}
    </section>
  );
}
