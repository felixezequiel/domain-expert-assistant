import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { EventPayloadTable } from "./EventPayloadTable.tsx";
import { formatDateTime } from "../../lib/format.ts";

describe("EventPayloadTable", () => {
  it("renders humanized keys and primitive values instead of raw JSON", () => {
    render(
      <EventPayloadTable
        data={{ sensitivityCeiling: "internal", version: 3, published: true }}
        emptyLabel="none"
      />,
    );
    expect(screen.getByText("Sensitivity ceiling")).toBeInTheDocument();
    expect(screen.getByText("internal")).toBeInTheDocument();
    expect(screen.getByText("Version")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("true")).toBeInTheDocument();
  });

  it("formats ISO timestamps the same way the trail does", () => {
    const iso = "2026-01-02T03:04:05.000Z";
    render(<EventPayloadTable data={{ occurredAt: iso }} emptyLabel="none" />);
    expect(screen.getByText(formatDateTime(iso))).toBeInTheDocument();
    expect(screen.queryByText(iso)).not.toBeInTheDocument();
  });

  it("shows a dash for null/empty values", () => {
    render(<EventPayloadTable data={{ reason: null, note: "" }} emptyLabel="none" />);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("joins arrays of primitives into a readable list", () => {
    render(<EventPayloadTable data={{ tags: ["alpha", "beta", "gamma"] }} emptyLabel="none" />);
    expect(screen.getByText("alpha, beta, gamma")).toBeInTheDocument();
  });

  it("recurses into nested objects, showing their inner fields", () => {
    render(
      <EventPayloadTable
        data={{ snapshot: { title: "Onboarding", status: "published" } }}
        emptyLabel="none"
      />,
    );
    expect(screen.getByText("Snapshot")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Onboarding")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("published")).toBeInTheDocument();
  });

  it("renders the empty label when the payload has no fields", () => {
    render(<EventPayloadTable data={{}} emptyLabel="No additional data" />);
    expect(screen.getByText("No additional data")).toBeInTheDocument();
  });

  it("renders arrays of objects as a list of nested tables", () => {
    render(
      <EventPayloadTable
        data={{ changes: [{ field: "title" }, { field: "body" }] }}
        emptyLabel="none"
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("title")).toBeInTheDocument();
    expect(within(items[1]!).getByText("body")).toBeInTheDocument();
  });
});
