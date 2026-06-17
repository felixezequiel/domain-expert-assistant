import { describe, it, expect } from "vitest";
import { stripMarkdown, statusBadge, formatDate } from "./format.ts";

describe("stripMarkdown", () => {
  it("removes heading, emphasis, code and link syntax but keeps the text", () => {
    const out = stripMarkdown("# Title\n\nSome **bold** and `code` and a [link](https://x.com).");
    expect(out).not.toContain("#");
    expect(out).not.toContain("**");
    expect(out).not.toContain("`");
    expect(out).not.toContain("https://x.com");
    expect(out).toContain("Title");
    expect(out).toContain("bold");
    expect(out).toContain("link");
  });
});

describe("statusBadge", () => {
  it("maps the knowledge lifecycle to a label + variant", () => {
    expect(statusBadge("published")).toEqual({ label: "Published", variant: "success" });
    expect(statusBadge("in_review").variant).toBe("warning");
  });

  it("falls back to the raw status for an unknown value", () => {
    expect(statusBadge("weird")).toEqual({ label: "weird", variant: "secondary" });
  });
});

describe("formatDate", () => {
  it("returns the input unchanged when it is not a valid date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});
