import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SecretRevealDialog } from "./SecretRevealDialog.tsx";

// The new SecretRevealDialog renders a shadcn (Radix) Dialog into a portal in document.body.
// testing-library queries the whole document, so getByText/getByTestId reach the portal.
describe("SecretRevealDialog", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("shows the secret once", () => {
    render(<SecretRevealDialog secret="abc.def" onClose={vi.fn()} />);

    expect(screen.getByText("Credential secret")).toBeInTheDocument();
    expect(screen.getByTestId("credential-secret").textContent).toBe("abc.def");
  });

  it("copies the secret to the clipboard and reflects the copied state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<SecretRevealDialog secret="abc.def" onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("abc.def");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("calls onClose when Done is clicked", async () => {
    const onClose = vi.fn();
    render(<SecretRevealDialog secret="abc.def" onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders a ready-to-paste MCP config with the server URL and the key", () => {
    render(<SecretRevealDialog secret="abc.def" onClose={vi.fn()} />);

    const snippet = screen.getByTestId("mcp-snippet").textContent ?? "";
    expect(snippet).toContain("/mcp");
    expect(snippet).toContain("abc.def");
  });

  it("copies the MCP config to the clipboard (distinct from the secret copy)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<SecretRevealDialog secret="abc.def" onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Copy config" }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("abc.def"));
    expect(screen.getByRole("button", { name: "Config copied" })).toBeInTheDocument();
  });

  it("lists setup steps for the default client", () => {
    render(<SecretRevealDialog secret="abc.def" onClose={vi.fn()} />);

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
  });
});
