import type { ReactNode } from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PolicyPage } from "./PolicyPage.tsx";
import { AuthContext, type Session } from "../../auth/AuthContext.tsx";
import { capabilitiesForRoles } from "../../auth/capabilities.ts";
import { usersApi } from "../../api/resources.ts";

vi.mock("../../api/resources.ts", () => ({
  usersApi: {
    getPolicy: vi.fn(),
    setPolicy: vi.fn(),
  },
}));

const usersApiMock = vi.mocked(usersApi);

const session: Session = {
  user: {
    userId: "admin1",
    companyId: "org-7",
    email: "admin@b.com",
    displayName: "Admin",
    roles: ["admin"],
    status: "active",
  },
  capabilities: capabilitiesForRoles(["admin"]),
};

function withAuth(children: ReactNode): JSX.Element {
  return (
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
  );
}

beforeEach(() => {
  usersApiMock.setPolicy.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PolicyPage", () => {
  it("prefills the checkbox checked when the policy requires a separate reviewer", async () => {
    usersApiMock.getPolicy.mockResolvedValue({ organizationId: "org-7", requireSeparateReviewer: true });
    render(withAuth(<PolicyPage />));

    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /Require a separate reviewer/i })).toBeChecked(),
    );
    expect(usersApiMock.getPolicy).toHaveBeenCalledWith("org-7");
  });

  it("saves the policy under the org id", async () => {
    usersApiMock.getPolicy.mockResolvedValue({ organizationId: "org-7", requireSeparateReviewer: false });
    render(withAuth(<PolicyPage />));

    await waitFor(() => expect(screen.getByRole("button", { name: "Save policy" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Save policy" }));

    await waitFor(() => expect(usersApiMock.setPolicy).toHaveBeenCalledWith("org-7", false));
  });
});
