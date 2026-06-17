import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileDropzone } from "./FileDropzone.tsx";

describe("FileDropzone", () => {
  it("reports the chosen file via the hidden input", async () => {
    const onFileChange = vi.fn();
    render(<FileDropzone id="f" file={null} onFileChange={onFileChange} />);

    const input = document.getElementById("f") as HTMLInputElement;
    const file = new File(["hi"], "notes.md", { type: "text/markdown" });
    await userEvent.upload(input, file);

    expect(onFileChange).toHaveBeenCalledWith(file);
  });

  it("shows the file chip with size and a working remove button", async () => {
    const onFileChange = vi.fn();
    const file = new File(["abcd"], "doc.txt", { type: "text/plain" });
    render(<FileDropzone id="f" file={file} onFileChange={onFileChange} />);

    expect(screen.getByText("doc.txt")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove file" }));
    expect(onFileChange).toHaveBeenCalledWith(null);
  });
});
