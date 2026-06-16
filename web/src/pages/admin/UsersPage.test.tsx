import type { ReactNode } from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsersPage } from "./UsersPage.tsx";
import { AuthContext, type Session } from "../../auth/AuthContext.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

const session: Session = {
  userId: "admin1",
  companyId: "org-42",
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

describe("UsersPage", () => {
  it("invites a user and surfaces the invitation token", async () => {
    const fetchFn = mockFetchSequence([{ status: 201, body: { userId: "u9", invitationToken: "inv-token-9" } }]);
    installFetch(fetchFn);
    render(withAuth(<UsersPage />));

    await userEvent.type(screen.getByLabelText("Email"), "new@b.com");
    await userEvent.type(screen.getByLabelText("Display name"), "New User");
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => expect(screen.getByTestId("invitation-token").textContent).toBe("inv-token-9"));
    // Invite is posted under the session's org id.
    expect(fetchFn.mock.calls[0]![0]).toBe("/organizations/org-42/users/invite");
  });
});
