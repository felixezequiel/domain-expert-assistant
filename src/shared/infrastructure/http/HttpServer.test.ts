import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { HttpServer } from "./HttpServer.ts";

const TEST_PORT = 0;

async function fetchJson(
  url: string,
  options?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, options);
  const body = await response.json();
  return { status: response.status, body };
}

describe("HttpServer", () => {
  let server: HttpServer;

  afterEach(async () => {
    if (server !== undefined) {
      await server.stop();
    }
  });

  it("should start and listen on the assigned port", async () => {
    server = new HttpServer();
    const port = await server.start(TEST_PORT);

    assert.ok(port > 0);
  });

  it("should route POST requests to registered handlers", async () => {
    server = new HttpServer();

    server.post("/users", async (requestBody) => {
      return { statusCode: 201, body: { id: "user-1", name: requestBody.name } };
    });

    const port = await server.start(TEST_PORT);

    const result = await fetchJson("http://localhost:" + port + "/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John" }),
    });

    assert.equal(result.status, 201);
    const responseBody = result.body as { id: string; name: string };
    assert.equal(responseBody.id, "user-1");
    assert.equal(responseBody.name, "John");
  });

  it("should return 404 for unregistered routes", async () => {
    server = new HttpServer();
    const port = await server.start(TEST_PORT);

    const result = await fetchJson("http://localhost:" + port + "/unknown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.equal(result.status, 404);
    const responseBody = result.body as { error: string };
    assert.equal(responseBody.error, "Not Found");
  });

  it("should return 500 when handler throws an error", async () => {
    server = new HttpServer();

    server.post("/fail", async () => {
      throw new Error("Something went wrong");
    });

    const port = await server.start(TEST_PORT);

    const result = await fetchJson("http://localhost:" + port + "/fail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.equal(result.status, 500);
    const responseBody = result.body as { error: string };
    assert.equal(responseBody.error, "Something went wrong");
  });

  it("should route GET requests to registered handlers", async () => {
    server = new HttpServer();

    server.get("/users/:userId", async (_requestBody, params) => {
      return { statusCode: 200, body: { id: params.userId } };
    });

    const port = await server.start(TEST_PORT);

    const result = await fetchJson("http://localhost:" + port + "/users/user-123", {
      method: "GET",
    });

    assert.equal(result.status, 200);
    const responseBody = result.body as { id: string };
    assert.equal(responseBody.id, "user-123");
  });

  it("should extract route params from POST routes", async () => {
    server = new HttpServer();

    server.post("/users/:userId/addresses", async (requestBody, params) => {
      return { statusCode: 201, body: { userId: params.userId, street: requestBody.street } };
    });

    const port = await server.start(TEST_PORT);

    const result = await fetchJson("http://localhost:" + port + "/users/user-1/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ street: "Rua A" }),
    });

    assert.equal(result.status, 201);
    const responseBody = result.body as { userId: string; street: string };
    assert.equal(responseBody.userId, "user-1");
    assert.equal(responseBody.street, "Rua A");
  });

  it("should stop the server gracefully", async () => {
    server = new HttpServer();
    const port = await server.start(TEST_PORT);

    await server.stop();

    await assert.rejects(() => fetch("http://localhost:" + port + "/any"));
  });
});
