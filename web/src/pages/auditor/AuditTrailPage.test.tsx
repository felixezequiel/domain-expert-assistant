import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuditTrailPage } from "./AuditTrailPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuditTrailPage", () => {
  it("lists audit events after searching with filters", async () => {
    const fetchFn = mockFetchSequence([
      {
        status: 200,
        body: {
          events: [
            {
              eventId: "e1",
              eventName: "KnowledgeItemPublished",
              aggregateId: "i1",
              occurredAt: "2026-01-01T00:00:00.000Z",
              companyId: "c1",
              actorId: "u1",
              actorType: "user",
              causationId: null,
            },
          ],
        },
      },
    ]);
    installFetch(fetchFn);
    render(<AuditTrailPage />);

    await userEvent.type(screen.getByPlaceholderText("Aggregate id"), "i1");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("KnowledgeItemPublished")).toBeInTheDocument());
    expect(fetchFn.mock.calls[0]![0]).toContain("aggregateId=i1");
    expect(fetchFn.mock.calls[0]![0]).toContain("limit=100");
  });

  it("shows a not-permitted notice on 403", async () => {
    installFetch(mockFetchSequence([{ status: 403, body: { error: "Forbidden" } }]));
    render(<AuditTrailPage />);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(screen.getByText(/not permitted/i)).toBeInTheDocument());
  });
});
