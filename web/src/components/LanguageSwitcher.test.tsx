import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageSwitcher } from "./LanguageSwitcher.tsx";
import i18n from "../i18n/index.ts";

afterEach(async () => {
  await i18n.changeLanguage("en-US"); // restore the test default for other suites
});

describe("LanguageSwitcher", () => {
  it("shows PT/EN with the active one pressed and switches the i18n language", async () => {
    render(<LanguageSwitcher />);

    const pt = screen.getByRole("button", { name: "PT" });
    const en = screen.getByRole("button", { name: "EN" });
    // Tests are pinned to en-US.
    expect(en).toHaveAttribute("aria-pressed", "true");
    expect(pt).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(pt);
    expect(i18n.language).toBe("pt-BR");

    await userEvent.click(en);
    expect(i18n.language).toBe("en-US");
  });
});
