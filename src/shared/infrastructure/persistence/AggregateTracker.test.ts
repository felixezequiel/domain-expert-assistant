import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { AggregateTracker } from "./AggregateTracker.ts";
import { AggregateRoot } from "../../domain/aggregates/AggregateRoot.ts";
import { Identifier } from "../../domain/identifiers/Identifier.ts";
import { EventEmittingAdapter } from "../adapters/EventEmittingAdapter.ts";
import type { DomainEventEmitter } from "../../domain/events/DomainEventEmitter.ts";

class FakeId extends Identifier {}

interface FakeProps {
  readonly name: string;
}

class FakeAggregate extends AggregateRoot<FakeId, FakeProps> {}

class FakeAdapter extends EventEmittingAdapter {}

describe("AggregateTracker", () => {
  beforeEach(() => {
    AggregateTracker.clear();
  });

  it("should track an aggregate after begin is called", () => {
    AggregateTracker.begin();

    const aggregate = new FakeAggregate(new FakeId("agg-1"), { name: "test" });
    AggregateTracker.track(aggregate);

    const drained = AggregateTracker.drain();

    assert.equal(drained.length, 1);
    assert.equal(drained[0], aggregate);
  });

  it("should track multiple aggregates", () => {
    AggregateTracker.begin();

    const firstAggregate = new FakeAggregate(new FakeId("agg-1"), { name: "first" });
    const secondAggregate = new FakeAggregate(new FakeId("agg-2"), { name: "second" });
    AggregateTracker.track(firstAggregate);
    AggregateTracker.track(secondAggregate);

    const drained = AggregateTracker.drain();

    assert.equal(drained.length, 2);
  });

  it("should not track duplicates of the same aggregate instance", () => {
    AggregateTracker.begin();

    const aggregate = new FakeAggregate(new FakeId("agg-1"), { name: "test" });
    AggregateTracker.track(aggregate);
    AggregateTracker.track(aggregate);

    const drained = AggregateTracker.drain();

    assert.equal(drained.length, 1);
  });

  it("should clear tracked aggregates without returning them", () => {
    AggregateTracker.begin();

    const aggregate = new FakeAggregate(new FakeId("agg-1"), { name: "test" });
    AggregateTracker.track(aggregate);

    AggregateTracker.clear();

    const drained = AggregateTracker.drain();

    assert.equal(drained.length, 0);
  });

  it("should drain and clear the tracked set", () => {
    AggregateTracker.begin();

    const aggregate = new FakeAggregate(new FakeId("agg-1"), { name: "test" });
    AggregateTracker.track(aggregate);

    const firstDrain = AggregateTracker.drain();
    const secondDrain = AggregateTracker.drain();

    assert.equal(firstDrain.length, 1);
    assert.equal(secondDrain.length, 0);
  });

  it("should not fail when tracking without begin", () => {
    const aggregate = new FakeAggregate(new FakeId("agg-1"), { name: "test" });

    assert.doesNotThrow(() => {
      AggregateTracker.track(aggregate);
    });
  });

  it("should return empty array when draining without begin", () => {
    const drained = AggregateTracker.drain();

    assert.equal(drained.length, 0);
  });

  it("should isolate tracking across async contexts", async () => {
    const firstSources: Array<DomainEventEmitter> = [];
    const secondSources: Array<DomainEventEmitter> = [];

    const firstRequest = AggregateTracker.run(async () => {
      AggregateTracker.begin();
      const aggregate = new FakeAggregate(new FakeId("agg-1"), { name: "first" });
      AggregateTracker.track(aggregate);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const drained = AggregateTracker.drain();
      for (const source of drained) {
        firstSources.push(source);
      }
    });

    const secondRequest = AggregateTracker.run(async () => {
      AggregateTracker.begin();
      const aggregate = new FakeAggregate(new FakeId("agg-2"), { name: "second" });
      AggregateTracker.track(aggregate);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const drained = AggregateTracker.drain();
      for (const source of drained) {
        secondSources.push(source);
      }
    });

    await Promise.all([firstRequest, secondRequest]);

    assert.equal(firstSources.length, 1);
    assert.equal(secondSources.length, 1);
    assert.notEqual(firstSources[0], secondSources[0]);
  });

  it("should support nested begin/drain scopes (stack-based)", () => {
    AggregateTracker.begin();

    const outerAggregate = new FakeAggregate(new FakeId("outer"), { name: "outer" });
    AggregateTracker.track(outerAggregate);

    AggregateTracker.begin();

    const innerAggregate = new FakeAggregate(new FakeId("inner"), { name: "inner" });
    AggregateTracker.track(innerAggregate);

    const innerDrained = AggregateTracker.drain();

    assert.equal(innerDrained.length, 1);
    assert.equal(innerDrained[0], innerAggregate);

    const outerDrained = AggregateTracker.drain();

    assert.equal(outerDrained.length, 1);
    assert.equal(outerDrained[0], outerAggregate);
  });

  it("should peek at tracked aggregates without removing them from the scope", () => {
    AggregateTracker.begin();

    const aggregate = new FakeAggregate(new FakeId("agg-1"), { name: "test" });
    AggregateTracker.track(aggregate);

    const peeked = AggregateTracker.peek();

    assert.equal(peeked.length, 1);
    assert.equal(peeked[0], aggregate);

    const drained = AggregateTracker.drain();

    assert.equal(drained.length, 1);
    assert.equal(drained[0], aggregate);
  });

  it("should return empty array when peeking without begin", () => {
    const peeked = AggregateTracker.peek();

    assert.equal(peeked.length, 0);
  });

  it("should not lose outer scope when inner scope is cleared", () => {
    AggregateTracker.begin();

    const outerAggregate = new FakeAggregate(new FakeId("outer"), { name: "outer" });
    AggregateTracker.track(outerAggregate);

    AggregateTracker.begin();
    AggregateTracker.clear();

    const outerDrained = AggregateTracker.drain();

    assert.equal(outerDrained.length, 1);
    assert.equal(outerDrained[0], outerAggregate);
  });

  it("should track an EventEmittingAdapter alongside aggregates", () => {
    AggregateTracker.begin();

    const aggregate = new FakeAggregate(new FakeId("agg-1"), { name: "test" });
    const adapter = new FakeAdapter();

    AggregateTracker.track(aggregate);
    AggregateTracker.track(adapter);

    const drained = AggregateTracker.drain();

    assert.equal(drained.length, 2);
  });
});
