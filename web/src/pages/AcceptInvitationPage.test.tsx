import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AcceptInvitationPage } from "./AcceptInvitationPage.tsx";
import { authApi } from "../api/resources.ts";

vi.mock("../api/resources.ts", () => ({
  authApi: {
    acceptInvitation: vi.fn(),
  },
}));

const authApiMock = vi.mocked(authApi);

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
  it("shows a validation error when the passwords do not match", async () => {
    renderAccept();

    await userEvent.type(screen.getByLabelText("Password"), "longenough1");
    await userEvent.type(screen.getByLabelText("Confirm password"), "different1");
    await userEvent.click(screen.getByRole("button", { name: "Activate account" }));

    await waitFor(() => expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument());
    expect(authApiMock.acceptInvitation).not.toHaveBeenCalled();
  });

  it("accepts the invitation when the passwords match and are long enough", async () => {
    authApiMock.acceptInvitation.mockResolvedValue({ userId: "u1", status: "active" });
    renderAccept();

    await userEvent.type(screen.getByLabelText("Password"), "longenough1");
    await userEvent.type(screen.getByLabelText("Confirm password"), "longenough1");
    await userEvent.click(screen.getByRole("button", { name: "Activate account" }));

    await waitFor(() => expect(authApiMock.acceptInvitation).toHaveBeenCalledWith("tok", "longenough1"));
    await waitFor(() => expect(screen.getByText("Your account is active.")).toBeInTheDocument());
  });
});
