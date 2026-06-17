import type { ReactNode } from "react";
import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CommandPalette } from "./CommandPalette.tsx";
import { AuthContext, type Session } from "../auth/AuthContext.tsx";
import { capabilitiesForRoles } from "../auth/capabilities.ts";
import type { Role } from "../api/types.ts";

beforeAll(() => {
  // cmdk calls scrollIntoView on the active item; jsdom doesn't implement it.
  Element.prototype.scrollIntoView = vi.fn();
});

function renderPalette(roles: ReadonlyArray<Role>, children: ReactNode = <CommandPalette />): void {
  const session: Session = {
    user: { userId: "u1", companyId: "c1", email: "x@e2e.test", displayName: "X", roles, status: "active" },
    capabilities: capabilitiesForRoles(roles),
  };
  render(
    <AuthContext.Provider
      value={{ session, isAuthenticated: true, loading: false, login: async () => undefined, logout: async () => undefined }}
    >
      <MemoryRouter>{children}</MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("CommandPalette", () => {
  it("opens from the trigger and lists capability-appropriate commands", async () => {
    renderPalette(["curator"]);

    await userEvent.click(screen.getByRole("button", { name: /Search or jump to/ }));

    await waitFor(() => expect(screen.getByText("Catalog")).toBeInTheDocument());
    // Curator-only command is present...
    expect(screen.getByText("New item")).toBeInTheDocument();
    // ...admin-only command is not.
    expect(screen.queryByText("Settings")).toBeNull();
  });
});
