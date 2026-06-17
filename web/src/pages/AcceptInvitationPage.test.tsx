import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AcceptInvitationPage } from "./AcceptInvitationPage.tsx";
import { authApi } from "../api/resources.ts";
import { ApiError } from "../api/ApiError.ts";

vi.mock("../api/resources.ts", () => ({
  authApi: {
    acceptInvitation: vi.fn(),
    invitation: vi.fn(),
  },
}));

const authApiMock = vi.mocked(authApi);

const INVITATION = {
  organizationName: "Acme Inc",
  email: "carl@example.test",
  roles: ["curator", "reviewer"],
};

function renderAccept(): void {
  render(
    <MemoryRouter initialEntries={["/invitations/tok"]}>
      <Routes>
        <Route path="/invitations/:token" element={<AcceptInvitationPage />} />
        <Route path="/login" element={<div>login screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("AcceptInvitationPage", () => {
  it("shows the inviting org, invited email, and assigned roles (U6)", async () => {
    authApiMock.invitation.mockResolvedValue(INVITATION);
    renderAccept();

    await waitFor(() => expect(authApiMock.invitation).toHaveBeenCalledWith("tok"));
    expect(await screen.findByText(/Join Acme Inc/)).toBeInTheDocument();
    expect(screen.getByText("carl@example.test")).toBeInTheDocument();
    expect(screen.getByText("curator")).toBeInTheDocument();
    expect(screen.getByText("reviewer")).toBeInTheDocument();
  });

  it("shows an invalid-invitation notice when the token is unknown", async () => {
    authApiMock.invitation.mockRejectedValue(new ApiError(404, "Invitation not found"));
    renderAccept();

    await waitFor(() => expect(screen.getByText("Invitation not found")).toBeInTheDocument());
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("shows a validation error when the passwords do not match", async () => {
    authApiMock.invitation.mockResolvedValue(INVITATION);
    renderAccept();

    await userEvent.type(screen.getByLabelText("Password"), "longenough1");
    await userEvent.type(screen.getByLabelText("Confirm password"), "different1");
    await userEvent.click(screen.getByRole("button", { name: "Activate account" }));

    await waitFor(() => expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument());
    expect(authApiMock.acceptInvitation).not.toHaveBeenCalled();
  });

  it("accepts the invitation when the passwords match and are long enough", async () => {
    authApiMock.invitation.mockResolvedValue(INVITATION);
    authApiMock.acceptInvitation.mockResolvedValue({ userId: "u1", status: "active" });
    renderAccept();

    await userEvent.type(screen.getByLabelText("Password"), "longenough1");
    await userEvent.type(screen.getByLabelText("Confirm password"), "longenough1");
    await userEvent.click(screen.getByRole("button", { name: "Activate account" }));

    await waitFor(() => expect(authApiMock.acceptInvitation).toHaveBeenCalledWith("tok", "longenough1"));
    await waitFor(() => expect(screen.getByText("Your account is active.")).toBeInTheDocument());
  });
});
