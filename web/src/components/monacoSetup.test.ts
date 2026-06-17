import { describe, it, expect, vi } from "vitest";

// `monaco-editor` + its ?worker are aliased to stubs in vite.config; stub the React wrapper's
// loader so importing the bootstrap module is side-effect-safe in jsdom.
vi.mock("@monaco-editor/react", () => ({ loader: { config: vi.fn() } }));

import { MONOKAI_THEME } from "./monacoSetup.ts";

describe("monacoSetup", () => {
  it("registers and exposes the Monokai theme name", () => {
    expect(MONOKAI_THEME).toBe("monokai");
  });
});
