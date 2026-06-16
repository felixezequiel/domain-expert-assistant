import { describe, it, expect, afterEach, vi } from "vitest";
import { itemsApi, collectionsApi, searchApi, auditApi, ingestionApi, authApi } from "./resources.ts";
import { mockFetchSequence, installFetch } from "../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resources", () => {
  it("posts login to /auth/login with email + password", async () => {
    const fetchFn = mockFetchSequence([{ status: 200, body: {} }]);
    installFetch(fetchFn);
    await authApi.login("a@b.com", "pw");
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("/auth/login");
    expect((init as RequestInit).body).toBe(JSON.stringify({ email: "a@b.com", password: "pw" }));
  });

  it("encodes path params for item lifecycle routes", async () => {
    const fetchFn = mockFetchSequence([{ status: 200, body: {} }]);
    installFetch(fetchFn);
    await itemsApi.approve("id with space");
    expect(fetchFn.mock.calls[0]![0]).toBe("/items/id%20with%20space/approve");
  });

  it("sends the rollback version number in the body", async () => {
    const fetchFn = mockFetchSequence([{ status: 200, body: {} }]);
    installFetch(fetchFn);
    await itemsApi.rollback("i1", 3);
    expect((fetchFn.mock.calls[0]![1] as RequestInit).body).toBe(JSON.stringify({ versionNumber: 3 }));
  });

  it("omits the optional description when creating a collection", async () => {
    const fetchFn = mockFetchSequence([{ status: 201, body: {} }]);
    installFetch(fetchFn);
    await collectionsApi.create("Name");
    expect((fetchFn.mock.calls[0]![1] as RequestInit).body).toBe(JSON.stringify({ name: "Name" }));
  });

  it("only includes provided search fields", async () => {
    const fetchFn = mockFetchSequence([{ status: 200, body: { results: [] } }]);
    installFetch(fetchFn);
    await searchApi.search("q", undefined, "internal");
    expect((fetchFn.mock.calls[0]![1] as RequestInit).body).toBe(
      JSON.stringify({ query: "q", sensitivityCeiling: "internal" }),
    );
  });

  it("builds the audit query string from the filter", async () => {
    const fetchFn = mockFetchSequence([{ status: 200, body: { events: [] } }]);
    installFetch(fetchFn);
    await auditApi.events({ aggregateId: "agg1", limit: 50 });
    const url = String(fetchFn.mock.calls[0]![0]);
    expect(url).toContain("aggregateId=agg1");
    expect(url).toContain("limit=50");
  });

  it("posts an ingestion upload with the base64 body", async () => {
    const fetchFn = mockFetchSequence([{ status: 202, body: { jobId: "j1", status: "pending" } }]);
    installFetch(fetchFn);
    await ingestionApi.upload("c1", "f.md", "text/markdown", "aGk=");
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("/ingestion/uploads");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ collectionId: "c1", filename: "f.md", mimeType: "text/markdown", contentBase64: "aGk=" }),
    );
  });
});
