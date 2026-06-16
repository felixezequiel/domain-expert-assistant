import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SecretRevealDialog } from "./SecretRevealDialog.tsx";

// Mirrors the CredentialsPage pattern: the secret is held in parent state and the dialog is
// the ONLY surface that shows it. Closing it clears the secret, so it can never reappear.
function Harness(): JSX.Element {
  const [secret, setSecret] = useState<string | null>("sk_live_TOPSECRET");
  return (
    <div>
      <span data-testid="held">{secret === null ? "cleared" : "held"}</span>
      {secret !== null ? (
        <SecretRevealDialog secret={secret} onClose={() => setSecret(null)} />
      ) : null}
    </div>
  );
}

describe("SecretRevealDialog", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
  });

  it("reveals the secret exactly once and never again after closing", async () => {
    render(<Harness />);

    expect(screen.getByTestId("credential-secret").textContent).toBe("sk_live_TOPSECRET");

    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByTestId("credential-secret")).toBeNull();
    expect(screen.getByTestId("held").textContent).toBe("cleared");
  });

  it("copies the secret to the clipboard", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("sk_live_TOPSECRET");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("warns that the secret is shown only once", () => {
    render(<Harness />);
    expect(screen.getByText(/shown only once/i)).toBeInTheDocument();
  });
});
