import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { auditApi, type AuditFilter } from "../../api/resources.ts";
import type { AuditEventView } from "../../api/types.ts";
import { ErrorNotice } from "../../components/AsyncBoundary.tsx";
import { DateRangePicker } from "../../components/DateRangePicker.tsx";
import { TableEmptyRow, TableSkeletonRows } from "../../components/TableState.tsx";
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
import i18n from "../../i18n/index.ts";

const DEFAULT_LIMIT = 100;

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };

// Prefer the resolved actor display name; fall back to the raw id, then to "system".
function actorLabel(event: AuditEventView): string {
  if (event.actorName !== null) {
    return event.actorName;
  }
  return event.actorId ?? i18n.t("audit.system");
}

// Read-only audit trail (Auditor persona). Filters by aggregate / actor / event name /
// time window. The endpoint is auditor/admin-gated server-side; a 403 renders as
// "not permitted" via ErrorNotice (the router also gates this page by capability).
export function AuditTrailPage(): JSX.Element {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [aggregateId, setAggregateId] = useState("");
  const [actorId, setActorId] = useState("");
  const [eventName, setEventName] = useState("");
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const [events, setEvents] = useState<ReadonlyArray<AuditEventView>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = async (aggregateOverride?: string): Promise<void> => {
    setLoading(true);
    setError(null);
    const effectiveAggregateId = aggregateOverride ?? aggregateId;
    const filter: Mutable<AuditFilter> = { limit: DEFAULT_LIMIT };
    if (effectiveAggregateId !== "") {
      filter.aggregateId = effectiveAggregateId;
    }
    if (actorId !== "") {
      filter.actorId = actorId;
    }
    if (eventName !== "") {
      filter.eventName = eventName;
    }
    if (range?.from !== undefined) {
      const start = new Date(range.from);
      start.setHours(0, 0, 0, 0);
      filter.from = start.toISOString();
    }
    if (range?.to !== undefined) {
      const end = new Date(range.to);
      end.setHours(23, 59, 59, 999);
      filter.to = end.toISOString();
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

  // Deep-link: a "View audit trail" link elsewhere (e.g. an item) navigates to
  // /audit?aggregateId=<id>; prefill the filter and run the search immediately.
  useEffect(() => {
    const preset = searchParams.get("aggregateId");
    if (preset !== null && preset !== "") {
      setAggregateId(preset);
      void runSearch(preset);
    }
    // Intentionally run once on mount for the initial deep-link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const COLUMN_COUNT = 5;
  let tableBody: ReactNode;
  if (loading) {
    tableBody = <TableSkeletonRows columns={COLUMN_COUNT} />;
  } else if (!searched) {
    tableBody = <TableEmptyRow columns={COLUMN_COUNT}>{t("audit.states.prompt")}</TableEmptyRow>;
  } else if (events.length === 0) {
    tableBody = <TableEmptyRow columns={COLUMN_COUNT}>{t("audit.states.empty")}</TableEmptyRow>;
  } else {
    tableBody = events.map((event) => (
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
        <TableCell>{actorLabel(event)}</TableCell>
        <TableCell>{event.actorType ?? t("audit.system")}</TableCell>
      </TableRow>
    ));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("audit.title")}</h1>

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="audit-aggregate">{t("audit.filters.aggregateId")}</Label>
            <Input
              id="audit-aggregate"
              placeholder={t("audit.filters.aggregateId")}
              value={aggregateId}
              onChange={(event) => setAggregateId(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-actor">{t("audit.filters.actorId")}</Label>
            <Input
              id="audit-actor"
              placeholder={t("audit.filters.actorId")}
              value={actorId}
              onChange={(event) => setActorId(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-event">{t("audit.filters.eventName")}</Label>
            <Input
              id="audit-event"
              placeholder={t("audit.filters.eventName")}
              value={eventName}
              onChange={(event) => setEventName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="audit-range">{t("audit.filters.dateRange")}</Label>
            <DateRangePicker
              id="audit-range"
              ariaLabel={t("audit.filters.dateRange")}
              placeholder={t("audit.dateRange.anyDate")}
              value={range}
              onChange={setRange}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => void runSearch()} disabled={loading}>
              <Search className="h-4 w-4" />
              {t("common.actions.search")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error !== null ? <ErrorNotice error={error} /> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("audit.columns.when")}</TableHead>
                <TableHead>{t("audit.columns.event")}</TableHead>
                <TableHead>{t("audit.columns.aggregate")}</TableHead>
                <TableHead>{t("audit.columns.actor")}</TableHead>
                <TableHead>{t("audit.columns.type")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{tableBody}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
