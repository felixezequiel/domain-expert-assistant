import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NoOpUnitOfWork } from "./NoOpUnitOfWork.ts";

/**
 * The NoOpUnitOfWork is the benchmark/no-persistence adapter: every lifecycle hook is a
 * no-op. These tests pin that contract — the full begin→commit / begin→rollback cycle
 * resolves without touching anything, in both read-write and read-only modes, and the
 * tracked-collection getters stay empty.
 */
describe("NoOpUnitOfWork", () => {
  it("completes a begin→commit cycle without error and tracks nothing", async () => {
    const unitOfWork = new NoOpUnitOfWork();
    await unitOfWork.begin();
    await unitOfWork.commit();
    assert.deepEqual(unitOfWork.getTrackedAggregates(), []);
    assert.deepEqual(unitOfWork.getTrackedEventSources(), []);
  });

  it("accepts a read-only begin", async () => {
    const unitOfWork = new NoOpUnitOfWork();
    await unitOfWork.begin(true);
    await unitOfWork.commit();
    assert.deepEqual(unitOfWork.getTrackedAggregates(), []);
  });

  it("completes a begin→rollback cycle without error", async () => {
    const unitOfWork = new NoOpUnitOfWork();
    await unitOfWork.begin();
    await unitOfWork.rollback();
    assert.deepEqual(unitOfWork.getTrackedAggregates(), []);
  });
});
