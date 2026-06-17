import type { ReactNode } from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { UsersPage } from "./UsersPage.tsx";
import { AuthContext, type Session } from "../../auth/AuthContext.tsx";
import { capabilitiesForRoles } from "../../auth/capabilities.ts";
import { usersApi } from "../../api/resources.ts";

vi.mock("../../api/resources.ts", () => ({
  usersApi: {
    list: vi.fn(),
    invite: vi.fn(),
    changeRoles: vi.fn(),
    disable: vi.fn(),
  },
}));

const usersApiMock = vi.mocked(usersApi);

const session: Session = {
  user: {
    userId: "admin1",
    companyId: "org-42",
    email: "admin@b.com",
    displayName: "Admin",
    roles: ["admin"],
    status: "active",
  },
  capabilities: capabilitiesForRoles(["admin"]),
};

function withAuth(children: ReactNode): JSX.Element {
  return (
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          session,
          isAuthenticated: true,
          loading: false,
          login: async () => undefined,
          logout: async () => undefined,
        }}
      >
        {children}
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  usersApiMock.list.mockResolvedValue({
    users: [
      { id: "u1", email: "jane@b.com", displayName: "Jane", roles: ["curator"], status: "active" },
    ],
  });
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("UsersPage", () => {
  it("renders the roster and the invite card", async () => {
    render(withAuth(<UsersPage />));

    await waitFor(() => expect(screen.getByText("jane@b.com")).toBeInTheDocument());
    expect(screen.getByText("Invite user")).toBeInTheDocument();
    expect(usersApiMock.list).toHaveBeenCalledWith("org-42");
  });

  it("surfaces the invitation token with a copy button after inviting", async () => {
    usersApiMock.invite.mockResolvedValue({ userId: "u9", invitationToken: "inv-token-9" });
    render(withAuth(<UsersPage />));

    await waitFor(() => expect(screen.getByText("jane@b.com")).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText("Email"), "new@b.com");
    await userEvent.type(screen.getByLabelText("Display name"), "New User");
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => expect(screen.getByTestId("invitation-token").textContent).toBe("inv-token-9"));
    expect(screen.getByRole("button", { name: /Copy accept link/i })).toBeInTheDocument();
    expect(usersApiMock.invite).toHaveBeenCalledWith("org-42", "new@b.com", "New User", ["consumer"]);
  });
});
