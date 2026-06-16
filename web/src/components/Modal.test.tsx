import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal.tsx";

describe("Modal", () => {
  it("renders a labelled dialog with its children", () => {
    render(
      <Modal title="My dialog" onClose={() => undefined}>
        <p>body content</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "My dialog" })).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("closes via the close button", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="t" onClose={onClose}>
        <span />
      </Modal>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close when the dialog body is clicked", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="t" onClose={onClose}>
        <span>inner</span>
      </Modal>,
    );
    await userEvent.click(screen.getByText("inner"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
