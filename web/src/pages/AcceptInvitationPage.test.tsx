import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AcceptInvitationPage } from "./AcceptInvitationPage.tsx";
import { mockFetchSequence, installFetch } from "../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

function renderAccept(): void {
  render(
    <MemoryRouter initialEntries={["/invitations/tok-123"]}>
      <Routes>
        <Route path="/invitations/:token" element={<AcceptInvitationPage />} />
        <Route path="/login" element={<div>login screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AcceptInvitationPage", () => {
  it("accepts the invitation and offers to sign in", async () => {
    const fetchFn = mockFetchSequence([{ status: 200, body: { userId: "u1", status: "active" } }]);
    installFetch(fetchFn);
    renderAccept();

    await userEvent.type(screen.getByLabelText("Choose a password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => expect(screen.getByText("Invitation accepted")).toBeInTheDocument());
    expect(fetchFn.mock.calls[0]![0]).toBe("/invitations/tok-123/accept");
  });

  it("surfaces an error on a bad token", async () => {
    installFetch(mockFetchSequence([{ status: 400, body: { error: "Invalid invitation" } }]));
    renderAccept();

    await userEvent.type(screen.getByLabelText("Choose a password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => expect(screen.getByText("Invalid invitation")).toBeInTheDocument());
  });
});
