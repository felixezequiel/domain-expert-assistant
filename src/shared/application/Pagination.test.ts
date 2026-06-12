import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPaginatedRequest, createPaginatedResponse } from "./Pagination.ts";

describe("Pagination", () => {
  describe("createPaginatedRequest", () => {
    it("should return default values when no arguments provided", () => {
      const request = createPaginatedRequest();

      assert.equal(request.page, 1);
      assert.equal(request.pageSize, 20);
    });

    it("should accept custom page and pageSize", () => {
      const request = createPaginatedRequest(2, 50);

      assert.equal(request.page, 2);
      assert.equal(request.pageSize, 50);
    });

    it("should normalize page less than 1 to 1", () => {
      const request = createPaginatedRequest(0, 20);

      assert.equal(request.page, 1);
    });

    it("should normalize negative page to 1", () => {
      const request = createPaginatedRequest(-5, 20);

      assert.equal(request.page, 1);
    });

    it("should limit pageSize to maximum of 100", () => {
      const request = createPaginatedRequest(1, 200);

      assert.equal(request.pageSize, 100);
    });

    it("should normalize pageSize less than 1 to default", () => {
      const request = createPaginatedRequest(1, 0);

      assert.equal(request.pageSize, 20);
    });

    it("should normalize negative pageSize to default", () => {
      const request = createPaginatedRequest(1, -10);

      assert.equal(request.pageSize, 20);
    });
  });

  describe("createPaginatedResponse", () => {
    it("should calculate totalPages correctly for exact division", () => {
      const request = createPaginatedRequest(1, 10);
      const response = createPaginatedResponse(["a", "b"], 20, request);

      assert.equal(response.totalPages, 2);
      assert.equal(response.total, 20);
      assert.equal(response.page, 1);
      assert.equal(response.pageSize, 10);
      assert.deepStrictEqual(response.items, ["a", "b"]);
    });

    it("should round up totalPages for non-exact division", () => {
      const request = createPaginatedRequest(1, 20);
      const response = createPaginatedResponse([], 55, request);

      assert.equal(response.totalPages, 3);
    });

    it("should return totalPages 0 when total is 0", () => {
      const request = createPaginatedRequest(1, 20);
      const response = createPaginatedResponse([], 0, request);

      assert.equal(response.totalPages, 0);
      assert.equal(response.total, 0);
    });

    it("should return totalPages 1 when total equals pageSize", () => {
      const request = createPaginatedRequest(1, 20);
      const response = createPaginatedResponse([], 20, request);

      assert.equal(response.totalPages, 1);
    });

    it("should preserve the items array", () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const request = createPaginatedRequest(1, 10);
      const response = createPaginatedResponse(items, 3, request);

      assert.deepStrictEqual(response.items, items);
    });
  });
});
