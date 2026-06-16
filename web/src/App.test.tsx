import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { App } from "./App.tsx";
import { mockFetchSequence, installFetch } from "./test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = "";
});

describe("App routing", () => {
  it("redirects an unauthenticated visit to the login screen", async () => {
    installFetch(mockFetchSequence([{ status: 401, body: { error: "Unauthorized" } }]));
    window.location.hash = "#/admin/users";
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument());
  });

  it("shows the accept-invitation screen for an invitation hash route", async () => {
    installFetch(mockFetchSequence([{ status: 200, body: {} }]));
    window.location.hash = "#/invitations/tok-1";
    render(<App />);
    await waitFor(() => expect(screen.getByText("Accept invitation")).toBeInTheDocument());
  });
});
