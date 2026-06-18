import { type JSX } from "react";
import { formatDateTime } from "../../lib/format.ts";

// A read-only, human-friendly view of a domain event's payload. Instead of dumping JSON,
// it renders a labelled key/value list, recursing into nested objects/arrays and formatting
// ISO timestamps the same way the rest of the audit trail does. Pure presentation — it owns
// no domain rules and is reused by the event-details dialog (Auditor persona).

const ISO_DATE_TIME_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// "sensitivityCeiling" -> "Sensitivity ceiling"; "company_id" -> "Company id".
function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (spaced.length === 0) {
    return key;
  }
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeTimestamp(value: string): boolean {
  return ISO_DATE_TIME_PREFIX.test(value) && !Number.isNaN(Date.parse(value));
}

function PayloadValue({ value }: { value: unknown }): JSX.Element {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "string") {
    if (value.length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }
    if (looksLikeTimestamp(value)) {
      return <span>{formatDateTime(value)}</span>;
    }
    return <span className="whitespace-pre-wrap break-words">{value}</span>;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="font-mono">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    return <PayloadArray items={value} />;
  }
  if (isPlainObject(value)) {
    return (
      <div className="border-l border-border pl-3">
        <PayloadRows data={value} />
      </div>
    );
  }
  return <span>{String(value)}</span>;
}

function PayloadArray({ items }: { items: ReadonlyArray<unknown> }): JSX.Element {
  if (items.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const allPrimitive = items.every((item) => item === null || typeof item !== "object");
  if (allPrimitive) {
    const joined = items.map((item) => (item === null ? "—" : String(item))).join(", ");
    return <span className="break-words">{joined}</span>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="border-l border-border pl-3">
          <PayloadValue value={item} />
        </li>
      ))}
    </ul>
  );
}

function PayloadRows({ data }: { data: Record<string, unknown> }): JSX.Element {
  return (
    <div className="space-y-3">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="grid gap-1 sm:grid-cols-[12rem_1fr] sm:gap-4">
          <div className="text-sm font-medium text-muted-foreground">{humanizeKey(key)}</div>
          <div className="text-sm">
            <PayloadValue value={value} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EventPayloadTable({
  data,
  emptyLabel,
}: {
  data: Record<string, unknown>;
  emptyLabel: string;
}): JSX.Element {
  if (Object.keys(data).length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return <PayloadRows data={data} />;
}
