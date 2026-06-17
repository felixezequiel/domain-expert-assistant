import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LoginPage } from "./LoginPage.tsx";
import { AuthProvider } from "../auth/AuthContext.tsx";
import { mockFetchSequence, installFetch } from "../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

const ME = {
  userId: "u1",
  companyId: "c1",
  email: "a@b.com",
  displayName: "Test Person",
  roles: ["curator"],
  status: "active",
};

function renderLogin(): void {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/search" element={<div>search screen</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("LoginPage", () => {
  it("logs in (login + /auth/me) and navigates to /search", async () => {
    // boot /auth/me (401, no cookie yet), then POST /auth/login (200), then /auth/me (200).
    installFetch(
      mockFetchSequence([
        { status: 401, body: { error: "Unauthorized" } },
        { status: 200, body: { userId: "u1", companyId: "c1", expiresAt: "2030-01-01T00:00:00.000Z" } },
        { status: 200, body: ME },
      ]),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText("Email"), "a@b.com");
    await userEvent.type(screen.getByLabelText("Password"), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByText("search screen")).toBeInTheDocument());
  });

  it("shows a credentials-specific message on a 401 (finding B2)", async () => {
    installFetch(
      mockFetchSequence([
        { status: 401, body: { error: "Unauthorized" } },
        { status: 401, body: { error: "Invalid credentials" } },
      ]),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText("Email"), "a@b.com");
    await userEvent.type(screen.getByLabelText("Password"), "bad");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByText("Invalid email or password.")).toBeInTheDocument());
    expect(screen.queryByText("search screen")).toBeNull();
  });
});
