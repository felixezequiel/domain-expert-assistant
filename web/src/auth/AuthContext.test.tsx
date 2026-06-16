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
          // The real screens catch login failures; swallow here so the rejection
          // does not surface as an unhandled rejection in the test runner.
          void login("a@b.com", "pw").catch(() => undefined);
        }}
      >
        login
      </button>
      <span data-testid="authed">{String(isAuthenticated)}</span>
      <span data-testid="user">{session?.userId ?? "none"}</span>
      <span data-testid="admin">{String(capabilities.canAdminister)}</span>
      <span data-testid="audit">{String(capabilities.canAudit)}</span>
    </div>
  );
}

describe("AuthContext", () => {
  it("logs in, stores the session in memory, and derives capabilities from the probes", async () => {
    // 1) POST /auth/login, 2) GET /credentials (admin probe), 3) GET /audit/events (audit probe).
    installFetch(
      mockFetchSequence([
        { status: 200, body: { userId: "u1", companyId: "c1", expiresAt: "2030-01-01T00:00:00.000Z" } },
        { status: 200, body: { credentials: [] } },
        { status: 403, body: { error: "Forbidden" } },
      ]),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId("authed").textContent).toBe("false");

    await userEvent.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByTestId("authed").textContent).toBe("true"));
    expect(screen.getByTestId("user").textContent).toBe("u1");
    expect(screen.getByTestId("admin").textContent).toBe("true");
    expect(screen.getByTestId("audit").textContent).toBe("false");
  });

  it("surfaces a login failure without setting a session", async () => {
    installFetch(mockFetchSequence([{ status: 401, body: { error: "Invalid credentials" } }]));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await userEvent.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByTestId("authed").textContent).toBe("false"));
    expect(screen.getByTestId("user").textContent).toBe("none");
  });
});
