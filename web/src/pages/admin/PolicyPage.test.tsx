import type { ReactNode } from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PolicyPage } from "./PolicyPage.tsx";
import { AuthContext, type Session } from "../../auth/AuthContext.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

const session: Session = {
  userId: "admin1",
  companyId: "org-7",
  expiresAt: "2030-01-01T00:00:00.000Z",
  capabilities: { canAdminister: true, canAudit: false },
};

function withAuth(children: ReactNode): JSX.Element {
  return (
    <AuthContext.Provider
      value={{ session, isAuthenticated: true, login: async () => undefined, logout: async () => undefined }}
    >
      {children}
    </AuthContext.Provider>
  );
}

describe("PolicyPage", () => {
  it("saves the requireSeparateReviewer toggle under the org id", async () => {
    const fetchFn = mockFetchSequence([{ status: 200, body: { requireSeparateReviewer: true } }]);
    installFetch(fetchFn);
    render(withAuth(<PolicyPage />));

    await userEvent.click(screen.getByLabelText(/Require a separate reviewer/i));
    await userEvent.click(screen.getByRole("button", { name: "Save policy" }));

    await waitFor(() => expect(screen.getByText(/Saved:/i)).toBeInTheDocument());
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("/organizations/org-7/policy");
    expect((init as RequestInit).body).toBe(JSON.stringify({ requireSeparateReviewer: true }));
  });
});
