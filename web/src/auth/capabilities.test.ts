import { describe, it, expect, afterEach, vi } from "vitest";
import { probeCapabilities } from "./capabilities.ts";
import { mockFetchSequence, installFetch } from "../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

// probeCapabilities issues two probes in order: GET /credentials, then GET /audit/events.
describe("probeCapabilities", () => {
  it("grants admin + audit when both probes return 200", async () => {
    installFetch(
      mockFetchSequence([
        { status: 200, body: { credentials: [] } },
        { status: 200, body: { events: [] } },
      ]),
    );
    const capabilities = await probeCapabilities();
    expect(capabilities).toEqual({ canAdminister: true, canAudit: true });
  });

  it("denies admin + audit when both probes return 403", async () => {
    installFetch(
      mockFetchSequence([
        { status: 403, body: { error: "Forbidden" } },
        { status: 403, body: { error: "Forbidden" } },
      ]),
    );
    const capabilities = await probeCapabilities();
    expect(capabilities).toEqual({ canAdminister: false, canAudit: false });
  });

  it("treats a non-authorization failure as available (lets the screen surface the error)", async () => {
    installFetch(
      mockFetchSequence([
        { status: 500, body: { error: "boom" } },
        { status: 500, body: { error: "boom" } },
      ]),
    );
    const capabilities = await probeCapabilities();
    expect(capabilities).toEqual({ canAdminister: true, canAudit: true });
  });
});
