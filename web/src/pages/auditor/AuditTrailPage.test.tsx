import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "../../api/ApiError.ts";
import { formatDateTime } from "../../lib/format.ts";
import type { AuditEventView } from "../../api/types.ts";

const events = vi.fn();

vi.mock("../../api/resources.ts", () => ({
  auditApi: { events: (...args: ReadonlyArray<unknown>) => events(...args) },
}));

import { AuditTrailPage } from "./AuditTrailPage.tsx";

const auditEvent: AuditEventView = {
  eventId: "e1",
  eventName: "KnowledgeItemPublished",
  aggregateId: "agg-1234567890",
  occurredAt: "2026-01-01T00:00:00.000Z",
  companyId: "c1",
  actorId: "u1",
  actorType: "user",
  causationId: null,
};

beforeEach(() => {
  events.mockReset();
});

describe("AuditTrailPage", () => {
  it("lists audit events after searching with filters", async () => {
    events.mockResolvedValue({ events: [auditEvent] });
    render(<AuditTrailPage />);

    expect(screen.getByRole("heading", { name: "Audit trail" })).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("Aggregate id"), "i1");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("KnowledgeItemPublished")).toBeInTheDocument());
    expect(events).toHaveBeenCalledWith(
      expect.objectContaining({ aggregateId: "i1", limit: 100 }),
    );
    // formatted, not raw ISO (U2)
    expect(screen.queryByText(auditEvent.occurredAt)).not.toBeInTheDocument();
    expect(screen.getByText(formatDateTime(auditEvent.occurredAt))).toBeInTheDocument();
  });

  it("shows an empty state when no events match", async () => {
    events.mockResolvedValue({ events: [] });
    render(<AuditTrailPage />);

    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(screen.getByText(/No events match these filters/i)).toBeInTheDocument());
  });

  it("shows a not-permitted notice on 403", async () => {
    events.mockRejectedValue(new ApiError(403, "Forbidden"));
    render(<AuditTrailPage />);

    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(screen.getByText(/not permitted/i)).toBeInTheDocument());
  });
});
