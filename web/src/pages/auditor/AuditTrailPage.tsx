import { useState } from "react";
import { Search } from "lucide-react";
import { auditApi, type AuditFilter } from "../../api/resources.ts";
import type { AuditEventView } from "../../api/types.ts";
import { ErrorNotice, Loading } from "../../components/AsyncBoundary.tsx";
import { formatDateTime } from "../../lib/format.ts";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent } from "../../components/ui/card.tsx";
import { Input } from "../../components/ui/input.tsx";
import { Label } from "../../components/ui/label.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table.tsx";

const DEFAULT_LIMIT = 100;

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };

// Read-only audit trail (Auditor persona). Filters by aggregate / actor / event name /
// time window. The endpoint is auditor/admin-gated server-side; a 403 renders as
// "not permitted" via ErrorNotice (the router also gates this page by capability).
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

  const runSearch = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const filter: Mutable<AuditFilter> = { limit: DEFAULT_LIMIT };
    if (aggregateId !== "") {
      filter.aggregateId = aggregateId;
    }
    if (actorId !== "") {
      filter.actorId = actorId;
    }
    if (eventName !== "") {
      filter.eventName = eventName;
    }
    if (from !== "") {
      filter.from = new Date(from).toISOString();
    }
    if (to !== "") {
      filter.to = new Date(to).toISOString();
    }
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

  const showResults = searched && !loading && error === null;
  const isEmpty = showResults && events.length === 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Audit trail</h1>

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="audit-aggregate">Aggregate id</Label>
            <Input
              id="audit-aggregate"
              placeholder="Aggregate id"
              value={aggregateId}
              onChange={(event) => setAggregateId(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-actor">Actor id</Label>
            <Input
              id="audit-actor"
              placeholder="Actor id"
              value={actorId}
              onChange={(event) => setActorId(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-event">Event name</Label>
            <Input
              id="audit-event"
              placeholder="Event name"
              value={eventName}
              onChange={(event) => setEventName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-from">From</Label>
            <Input
              id="audit-from"
              type="datetime-local"
              aria-label="From"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-to">To</Label>
            <Input
              id="audit-to"
              type="datetime-local"
              aria-label="To"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => void runSearch()} disabled={loading}>
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {error !== null && <ErrorNotice error={error} />}
      {loading && <Loading />}

      {isEmpty && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No events match these filters.
          </CardContent>
        </Card>
      )}

      {showResults && events.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Aggregate</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.eventId}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(event.occurredAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {event.eventName}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code
                        className="block max-w-[16rem] truncate font-mono text-xs"
                        title={event.aggregateId}
                      >
                        {event.aggregateId}
                      </code>
                    </TableCell>
                    <TableCell>{event.actorId ?? "system"}</TableCell>
                    <TableCell>{event.actorType ?? "system"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
