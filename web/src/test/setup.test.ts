import { describe, it, expect } from "vitest";

// The setup module only registers jest-dom matchers (a side effect). This asserts the
// matchers are available, which doubles as the co-located test for setup.ts.
describe("test setup", () => {
  it("registers jest-dom matchers", () => {
    const element = document.createElement("div");
    element.textContent = "hi";
    expect(element).toHaveTextContent("hi");
  });
});
