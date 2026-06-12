import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { State } from "./State.ts";

describe("State", () => {
  it("should create a state with a valid value", () => {
    const state = new State("SP");

    assert.equal(state.value, "SP");
  });

  it("should throw when state is empty", () => {
    assert.throws(() => new State(""), {
      message: "State cannot be empty",
    });
  });

  it("should be equal to another State with the same value", () => {
    const firstState = new State("SP");
    const secondState = new State("SP");

    assert.ok(firstState.equals(secondState));
  });

  it("should not be equal to a State with a different value", () => {
    const firstState = new State("SP");
    const secondState = new State("RJ");

    assert.ok(!firstState.equals(secondState));
  });
});
