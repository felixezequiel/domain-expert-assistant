import { describe, it, expect } from "vitest";
import { cn } from "./utils.ts";

describe("cn", () => {
  it("joins truthy classes and drops falsy ones", () => {
    expect(cn("a", false, undefined, "c")).toBe("a c");
  });

  it("de-conflicts competing tailwind utilities (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
