import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { enrichDomainEvents, EnvelopeTenantMismatchError } from "./EventEnricher.ts";
import { AggregateRoot } from "../../domain/aggregates/AggregateRoot.ts";
import { Identifier } from "../../domain/identifiers/Identifier.ts";
import { BaseDomainEvent } from "../../domain/events/BaseDomainEvent.ts";
import type { TenantScoped } from "../../domain/TenantScoped.ts";
import type { Actor } from "../context/ActorContext.ts";

class SampleId extends Identifier {}

class SampleEvent extends BaseDomainEvent {
  public readonly eventName = "Sample";
  constructor(aggregateId: string) {
    super(aggregateId);
  }
}

interface TenantProps {
  readonly companyId: string;
}

class TenantAggregate extends AggregateRoot<SampleId, TenantProps> implements TenantScoped {
  public get companyId(): string {
    return this.props.companyId;
  }

  public static make(id: string, companyId: string): TenantAggregate {
    return new TenantAggregate(new SampleId(id), { companyId });
  }
}

interface PlainProps {
  readonly name: string;
}

class PlainAggregate extends AggregateRoot<SampleId, PlainProps> {
  public static make(id: string): PlainAggregate {
    return new PlainAggregate(new SampleId(id), { name: "x" });
  }
}

const TENANT_USER: Actor = { companyId: "company-1", actorId: "user-1", actorType: "user" };

describe("enrichDomainEvents", () => {
  it("stamps the envelope of every event from the actor context", () => {
    const event = new SampleEvent("agg-1");

    enrichDomainEvents([event], TENANT_USER, []);

    assert.equal(event.companyId, "company-1");
    assert.equal(event.actorId, "user-1");
    assert.equal(event.actorType, "user");
  });

  it("stamps nulls when there is no actor (e.g. tests / non-tenant tasks)", () => {
    const event = new SampleEvent("agg-1");

    enrichDomainEvents([event], null, []);

    assert.equal(event.companyId, null);
    assert.equal(event.actorId, null);
    assert.equal(event.actorType, null);
  });

  it("passes the cross-check when a tenant aggregate matches the context tenant", () => {
    const aggregate = TenantAggregate.make("agg-1", "company-1");
    const event = new SampleEvent("agg-1");

    assert.doesNotThrow(() => enrichDomainEvents([event], TENANT_USER, [aggregate]));
    assert.equal(event.companyId, "company-1");
  });

  it("throws fail-closed when a tenant aggregate belongs to a different tenant", () => {
    const aggregate = TenantAggregate.make("agg-1", "company-OTHER");
    const event = new SampleEvent("agg-1");

    assert.throws(
      () => enrichDomainEvents([event], TENANT_USER, [aggregate]),
      EnvelopeTenantMismatchError,
    );
  });

  it("throws fail-closed when a tenant aggregate is touched without a tenant context", () => {
    const aggregate = TenantAggregate.make("agg-1", "company-1");
    const event = new SampleEvent("agg-1");

    assert.throws(() => enrichDomainEvents([event], null, [aggregate]), EnvelopeTenantMismatchError);
  });

  it("does not cross-check aggregates that are not tenant-scoped", () => {
    const aggregate = PlainAggregate.make("agg-1");
    const event = new SampleEvent("agg-1");

    assert.doesNotThrow(() => enrichDomainEvents([event], TENANT_USER, [aggregate]));
    assert.equal(event.companyId, "company-1");
  });

  it("stamps events with no matching tracked aggregate (adapter events) from context only", () => {
    const aggregate = TenantAggregate.make("agg-1", "company-1");
    const adapterEvent = new SampleEvent("adapter-99");

    assert.doesNotThrow(() => enrichDomainEvents([adapterEvent], TENANT_USER, [aggregate]));
    assert.equal(adapterEvent.companyId, "company-1");
  });
});
