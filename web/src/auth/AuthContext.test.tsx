import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth, useCapabilities } from "./AuthContext.tsx";
import { mockFetchSequence, installFetch } from "../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

function Probe(): JSX.Element {
  const { session, isAuthenticated, login } = useAuth();
  const capabilities = useCapabilities();
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void login("a@b.com", "pw").catch(() => undefined);
        }}
      >
        login
      </button>
      <span data-testid="authed">{String(isAuthenticated)}</span>
      <span data-testid="user">{session?.user.userId ?? "none"}</span>
      <span data-testid="name">{session?.user.displayName ?? "none"}</span>
      <span data-testid="admin">{String(capabilities.canAdminister)}</span>
      <span data-testid="audit">{String(capabilities.canAudit)}</span>
    </div>
  );
}

const ADMIN_ME = {
  userId: "u1",
  companyId: "c1",
  email: "ada@acme.com",
  displayName: "Ada Admin",
  roles: ["admin"],
  status: "active",
};

describe("AuthContext", () => {
  it("restores the session from the cookie on boot via /auth/me (finding U3)", async () => {
    installFetch(mockFetchSequence([{ status: 200, body: ADMIN_ME }]));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("authed").textContent).toBe("true"));
    expect(screen.getByTestId("user").textContent).toBe("u1");
    expect(screen.getByTestId("name").textContent).toBe("Ada Admin");
    expect(screen.getByTestId("admin").textContent).toBe("true");
  });

  it("logs in, stores the session, and derives capabilities from the user's roles", async () => {
    // 1) boot /auth/me (no cookie yet) -> 401, 2) POST /auth/login -> 200, 3) /auth/me -> 200.
    installFetch(
      mockFetchSequence([
        { status: 401, body: { error: "Unauthorized" } },
        { status: 200, body: { userId: "u1", companyId: "c1", expiresAt: "2030-01-01T00:00:00.000Z" } },
        { status: 200, body: ADMIN_ME },
      ]),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("authed").textContent).toBe("false"));
    await userEvent.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByTestId("authed").textContent).toBe("true"));
    expect(screen.getByTestId("user").textContent).toBe("u1");
    expect(screen.getByTestId("admin").textContent).toBe("true");
    expect(screen.getByTestId("audit").textContent).toBe("true");
  });

  it("surfaces a login failure without setting a session", async () => {
    installFetch(
      mockFetchSequence([
        { status: 401, body: { error: "Unauthorized" } },
        { status: 401, body: { error: "Invalid credentials" } },
      ]),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("authed").textContent).toBe("false"));
    await userEvent.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("none"));
    expect(screen.getByTestId("authed").textContent).toBe("false");
  });
});
