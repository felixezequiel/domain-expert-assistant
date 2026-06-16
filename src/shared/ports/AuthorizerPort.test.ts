import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AuthorizerPort } from "./AuthorizerPort.ts";
import type { Role } from "../domain/Role.ts";

describe("AuthorizerPort", () => {
  it("is satisfied by an object exposing authorize(requiredRoles)", () => {
    const captured: Array<ReadonlyArray<Role>> = [];
    const authorizer: AuthorizerPort = {
      authorize(requiredRoles) {
        captured.push(requiredRoles);
      },
    };

    authorizer.authorize(["admin"]);

    assert.deepEqual(captured, [["admin"]]);
  });
});
