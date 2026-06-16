import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import { DomainEventManager } from "../../../shared/application/DomainEventManager.ts";
import { InMemoryUnitOfWork } from "../../../shared/infrastructure/persistence/adapters/InMemoryUnitOfWork.ts";
import { AggregateTracker } from "../../../shared/infrastructure/persistence/AggregateTracker.ts";
import { AggregateRoot } from "../../../shared/domain/aggregates/AggregateRoot.ts";
import { Identifier } from "../../../shared/domain/identifiers/Identifier.ts";
import { BaseDomainEvent } from "../../../shared/domain/events/BaseDomainEvent.ts";
import type { DomainEvent } from "../../../shared/domain/events/DomainEvent.ts";
import type { TenantScoped } from "../../../shared/domain/TenantScoped.ts";
import type { UseCase } from "../../../shared/application/UseCase.ts";
import type { EventPublisherPort } from "../../../shared/ports/EventPublisherPort.ts";
import type { EventStorePort } from "../../../shared/ports/EventStorePort.ts";
import { runWithActor } from "../../../shared/application/context/ActorContext.ts";
import { EnvelopeTenantMismatchError } from "../../../shared/application/events/EventEnricher.ts";
import { MissingTenantContextError } from "../../../shared/application/tenancy/TenantScopeResolution.ts";
import { InMemoryAuditTrailRepository } from "../infrastructure/persistence/in-memory/InMemoryAuditTrailRepository.ts";
import { ListAuditTrailUseCase } from "../application/usecase/ListAuditTrailUseCase.ts";
import { ListAuditTrailQuery } from "../application/query/ListAuditTrailQuery.ts";

class NoteId extends Identifier {}

class NoteCreatedEvent extends BaseDomainEvent {
  public readonly eventName = "NoteCreated";
  constructor(aggregateId: string) {
    super(aggregateId);
  }
}

interface NoteProps {
  readonly companyId: string;
}

class Note extends AggregateRoot<NoteId, NoteProps> implements TenantScoped {
  public get companyId(): string {
    return this.props.companyId;
  }

  public static create(id: string, companyId: string): Note {
    const note = new Note(new NoteId(id), { companyId });
    note.addDomainEvent(new NoteCreatedEvent(id));
    return note;
  }
}

interface CreateNoteCommand {
  readonly id: string;
  readonly companyId: string;
}

class CreateNoteUseCase implements UseCase<CreateNoteCommand, Note> {
  public async execute(command: CreateNoteCommand): Promise<Note> {
    return Note.create(command.id, command.companyId);
  }
}

class FakePublisher implements EventPublisherPort {
  public async publish(): Promise<void> {}
  public async publishAll(): Promise<void> {}
}

// Bridges the stamped event stream into the audit read model, exactly like the real
// event store persists the enriched envelope into system_events.
class AuditSeedingEventStore implements EventStorePort {
  constructor(private readonly repository: InMemoryAuditTrailRepository) {}

  public async saveAll(events: ReadonlyArray<DomainEvent>): Promise<void> {
    for (const event of events) {
      this.repository.seed({
        eventId: event.eventId,
        eventName: event.eventName,
        aggregateId: event.aggregateId,
        occurredAt: event.occurredAt.toISOString(),
        companyId: event.companyId ?? null,
        actorId: event.actorId ?? null,
        actorType: event.actorType ?? null,
        causationId: event.causationId,
      });
    }
  }
}

function buildStack() {
  const repository = new InMemoryAuditTrailRepository();
  const unitOfWork = new InMemoryUnitOfWork([
    { supports: (aggregate) => aggregate instanceof Note, save: async () => {} },
  ]);
  const applicationService = new ApplicationService(
    unitOfWork,
    new DomainEventManager(),
    new FakePublisher(),
    new AuditSeedingEventStore(repository),
  );
  return { repository, applicationService, useCase: new CreateNoteUseCase() };
}

const TENANT_A = { companyId: "company-A", actorId: "user-A", actorType: "user" as const };
const TENANT_B = { companyId: "company-B", actorId: "user-B", actorType: "user" as const };
const OPERATOR = { companyId: null, actorId: "op-1", actorType: "operator" as const };

describe("Audit isolation (PRD-0)", () => {
  beforeEach(() => {
    AggregateRoot.setOnTrack((aggregate) => AggregateTracker.track(aggregate));
  });

  afterEach(() => {
    AggregateRoot.setOnTrack(null);
  });

  it("stamps events with the originating tenant and isolates auditors per tenant", async () => {
    const { repository, applicationService, useCase } = buildStack();

    await runWithActor(TENANT_A, () =>
      applicationService.execute(useCase, { id: "note-a1", companyId: "company-A" }),
    );
    await runWithActor(TENANT_A, () =>
      applicationService.execute(useCase, { id: "note-a2", companyId: "company-A" }),
    );
    await runWithActor(TENANT_B, () =>
      applicationService.execute(useCase, { id: "note-b1", companyId: "company-B" }),
    );

    const listAuditTrail = new ListAuditTrailUseCase(repository);

    const seenByA = await runWithActor(TENANT_A, () =>
      listAuditTrail.execute(ListAuditTrailQuery.of()),
    );
    const seenByB = await runWithActor(TENANT_B, () =>
      listAuditTrail.execute(ListAuditTrailQuery.of()),
    );

    assert.deepEqual(
      seenByA.map((event) => event.aggregateId).sort(),
      ["note-a1", "note-a2"],
    );
    assert.deepEqual(
      seenByB.map((event) => event.aggregateId),
      ["note-b1"],
    );
    assert.equal(seenByA.every((event) => event.companyId === "company-A"), true);
  });

  it("captures operator actions but keeps them invisible to tenant auditors", async () => {
    const { repository, applicationService, useCase } = buildStack();

    // An operator (privileged) action stamps companyId = null.
    await runWithActor(OPERATOR, () =>
      applicationService.execute(useCase, { id: "note-op", companyId: "company-A" }),
    );
    await runWithActor(TENANT_A, () =>
      applicationService.execute(useCase, { id: "note-a1", companyId: "company-A" }),
    );

    const listAuditTrail = new ListAuditTrailUseCase(repository);

    const seenByA = await runWithActor(TENANT_A, () =>
      listAuditTrail.execute(ListAuditTrailQuery.of()),
    );
    const seenByOperator = await runWithActor(OPERATOR, () =>
      listAuditTrail.execute(ListAuditTrailQuery.of()),
    );

    assert.deepEqual(
      seenByA.map((event) => event.aggregateId),
      ["note-a1"],
    );
    assert.equal(seenByOperator.length, 2);
  });

  it("aborts a cross-tenant write before persisting (fail-closed)", async () => {
    const { repository, applicationService, useCase } = buildStack();

    // Aggregate belongs to company-A but the actor context is company-B.
    await assert.rejects(
      () =>
        runWithActor(TENANT_B, () =>
          applicationService.execute(useCase, { id: "note-evil", companyId: "company-A" }),
        ),
      EnvelopeTenantMismatchError,
    );

    const seenByB = await runWithActor(TENANT_B, () =>
      new ListAuditTrailUseCase(repository).execute(ListAuditTrailQuery.of()),
    );
    assert.equal(seenByB.length, 0);
  });

  it("denies auditing with no tenant and no privileged scope (fail-closed)", async () => {
    const { repository } = buildStack();

    await assert.rejects(
      () => new ListAuditTrailUseCase(repository).execute(ListAuditTrailQuery.of()),
      MissingTenantContextError,
    );
  });
});
