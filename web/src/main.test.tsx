import { describe, it, expect, afterEach, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { mockFetchSequence, installFetch } from "./test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  vi.resetModules();
});

describe("main entry", () => {
  it("mounts the app into #root", async () => {
    installFetch(mockFetchSequence([{ status: 401, body: { error: "Unauthorized" } }]));
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    await import("./main.tsx");

    // App renders (login screen for an unauthenticated session) inside #root.
    await waitFor(() => expect(root.querySelector("form")).not.toBeNull());
  });
});
