import { describe, it, expect } from "vitest";
import { ApiError } from "./ApiError.ts";

describe("ApiError", () => {
  it("classifies 401 as unauthorized", () => {
    const error = new ApiError(401, "Unauthorized");
    expect(error.isUnauthorized).toBe(true);
    expect(error.isForbidden).toBe(false);
    expect(error.isBadRequest).toBe(false);
  });

  it("classifies 403 as forbidden", () => {
    expect(new ApiError(403, "Forbidden").isForbidden).toBe(true);
  });

  it("classifies 400 as bad request", () => {
    expect(new ApiError(400, "bad").isBadRequest).toBe(true);
  });

  it("carries status and message and is an Error", () => {
    const error = new ApiError(500, "boom");
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(500);
    expect(error.message).toBe("boom");
  });
});
