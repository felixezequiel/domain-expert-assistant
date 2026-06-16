import { describe, it, expect, afterEach, vi } from "vitest";
import { apiClient } from "./apiClient.ts";
import { ApiError } from "./ApiError.ts";
import { mockFetchSequence, installFetch } from "../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiClient", () => {
  it("sends credentials:include and parses a JSON 200", async () => {
    const fetchFn = mockFetchSequence([{ status: 200, body: { ok: true } }]);
    installFetch(fetchFn);

    const result = await apiClient.get<{ ok: boolean }>("/items");

    expect(result).toEqual({ ok: true });
    const [, init] = fetchFn.mock.calls[0]!;
    expect((init as RequestInit).credentials).toBe("include");
  });

  it("serializes a JSON body and sets the content-type on POST", async () => {
    const fetchFn = mockFetchSequence([{ status: 201, body: { id: "1" } }]);
    installFetch(fetchFn);

    await apiClient.post("/items", { title: "T" });

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("/items");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(JSON.stringify({ title: "T" }));
    expect((init as RequestInit).headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it("appends defined query params and skips empty ones", async () => {
    const fetchFn = mockFetchSequence([{ status: 200, body: {} }]);
    installFetch(fetchFn);

    await apiClient.get("/items", { collectionId: "c1", status: "" });

    expect(fetchFn.mock.calls[0]![0]).toBe("/items?collectionId=c1");
  });

  it("throws ApiError(401) on unauthorized", async () => {
    installFetch(mockFetchSequence([{ status: 401, body: { error: "Unauthorized" } }]));
    await expect(apiClient.get("/items")).rejects.toMatchObject({ status: 401 });
  });

  it("throws ApiError(403) carrying the server message", async () => {
    installFetch(mockFetchSequence([{ status: 403, body: { error: "Forbidden: admin role required" } }]));
    await expect(apiClient.get("/credentials")).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiError && error.isForbidden && error.message === "Forbidden: admin role required",
    );
  });

  it("throws ApiError(400) with the validation message", async () => {
    installFetch(mockFetchSequence([{ status: 400, body: { error: "Field 'title' is required" } }]));
    await expect(apiClient.post("/items", {})).rejects.toMatchObject({
      status: 400,
      message: "Field 'title' is required",
    });
  });
});
