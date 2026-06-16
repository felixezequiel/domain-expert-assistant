import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { UnitOfWork } from "./UnitOfWork.ts";
import type { AggregateRoot } from "../domain/aggregates/AggregateRoot.ts";
import type { Identifier } from "../domain/identifiers/Identifier.ts";
import type { DomainEventEmitter } from "../domain/events/DomainEventEmitter.ts";

/**
 * Contract test for the UnitOfWork port. It is a pure interface, so the meaningful guarantee
 * to pin is its shape — in particular that `begin` is callable both with and without the
 * `readOnly` flag (ADR-004 amendment), so a query can open a READ ONLY transaction while a
 * command opens a read-write one. A conforming stub exercises the full surface.
 */
class StubUnitOfWork implements UnitOfWork {
  public readonly beginCalls: Array<boolean | undefined> = [];

  public async begin(readOnly?: boolean): Promise<void> {
    this.beginCalls.push(readOnly);
  }
  public async commit(): Promise<void> {}
  public async rollback(): Promise<void> {}
  public getTrackedAggregates(): ReadonlyArray<AggregateRoot<Identifier, object>> {
    return [];
  }
  public getTrackedEventSources(): ReadonlyArray<DomainEventEmitter> {
    return [];
  }
}

describe("UnitOfWork contract", () => {
  it("allows begin() without arguments (read-write by default)", async () => {
    const unitOfWork: UnitOfWork = new StubUnitOfWork();
    await unitOfWork.begin();
    assert.deepEqual((unitOfWork as StubUnitOfWork).beginCalls, [undefined]);
  });

  it("allows begin(true) to request a read-only transaction", async () => {
    const stub = new StubUnitOfWork();
    const unitOfWork: UnitOfWork = stub;
    await unitOfWork.begin(true);
    assert.deepEqual(stub.beginCalls, [true]);
  });

  it("exposes empty tracked collections by default", () => {
    const unitOfWork: UnitOfWork = new StubUnitOfWork();
    assert.deepEqual(unitOfWork.getTrackedAggregates(), []);
    assert.deepEqual(unitOfWork.getTrackedEventSources(), []);
  });
});
