import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IndexProjectionWorker } from "./IndexProjectionWorker.ts";
import { EventEmitterEventBus } from "../../../../shared/infrastructure/events/EventEmitterEventBus.ts";
import {
  ProjectItemUseCase,
  DeprecateItemIndexUseCase,
  RemoveItemFromIndexUseCase,
} from "../../application/usecase/IndexingUseCases.ts";
import { SemanticSearchUseCase } from "../../application/usecase/SemanticSearchUseCase.ts";
import {
  FakeEmbedder,
  FakeChunkIndexRepository,
  FakePublishedItemReader,
} from "../../application/testDoubles/index.ts";
import { SemanticSearchCommand } from "../../application/command/RetrievalCommands.ts";
import {
  KnowledgeItemPublishedEvent,
  KnowledgeItemDeprecatedEvent,
  KnowledgeItemArchivedEvent,
} from "../../../knowledge/domain/events/KnowledgeItemEvents.ts";
import type { ApplicationService } from "../../../../shared/application/ApplicationService.ts";
import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { DomainEvent } from "../../../../shared/domain/events/DomainEvent.ts";
import type { PublishedItem } from "../../application/types.ts";

const directApplicationService = {
  execute<C, R>(useCase: UseCase<C, R>, command: C): Promise<R> {
    return useCase.execute(command);
  },
} as unknown as ApplicationService;

function publishedItem(): PublishedItem {
  return {
    itemId: "item-1",
    companyId: "company-1",
    collectionId: "col-1",
    title: "Refund policy",
    body: "Customers may request a refund within 30 days.",
    sensitivity: "internal",
    publishedVersion: 1,
    publishedAt: "2026-06-16T00:00:00.000Z",
    stale: false,
  };
}

function enrich(event: DomainEvent, companyId: string): DomainEvent {
  (event as { companyId: string | null }).companyId = companyId;
  return event;
}

function buildWorker(reader: FakePublishedItemReader, embedder: FakeEmbedder, index: FakeChunkIndexRepository) {
  const project = new ProjectItemUseCase(reader, embedder, index);
  return new IndexProjectionWorker(
    directApplicationService,
    project,
    new DeprecateItemIndexUseCase(index),
    new RemoveItemFromIndexUseCase(index),
  );
}

describe("IndexProjectionWorker", () => {
  it("only enqueues on the published event — indexing does not run inside the publish commit", async () => {
    const reader = new FakePublishedItemReader();
    const embedder = new FakeEmbedder();
    const index = new FakeChunkIndexRepository();
    reader.add(publishedItem());
    const worker = buildWorker(reader, embedder, index);
    const eventBus = new EventEmitterEventBus();
    worker.subscribe(eventBus);

    await eventBus.publishAll([enrich(new KnowledgeItemPublishedEvent("item-1", 1), "company-1")]);

    assert.equal(worker.pendingCount(), 1);
    // Nothing indexed yet.
    const beforeDrain = await new SemanticSearchUseCase(embedder, index).execute(
      SemanticSearchCommand.of("company-1", "refund"),
    );
    assert.equal(beforeDrain.length, 0);
  });

  it("indexes the published item after draining", async () => {
    const reader = new FakePublishedItemReader();
    const embedder = new FakeEmbedder();
    const index = new FakeChunkIndexRepository();
    reader.add(publishedItem());
    const worker = buildWorker(reader, embedder, index);
    const eventBus = new EventEmitterEventBus();
    worker.subscribe(eventBus);

    await eventBus.publishAll([enrich(new KnowledgeItemPublishedEvent("item-1", 1), "company-1")]);
    const processed = await worker.drainOnce();

    assert.equal(processed, 1);
    const results = await new SemanticSearchUseCase(embedder, index).execute(
      SemanticSearchCommand.of("company-1", "refund"),
    );
    assert.ok(results.length >= 1);
    assert.equal(results[0]!.itemId, "item-1");
  });

  it("flags stale on deprecate and removes on archive", async () => {
    const reader = new FakePublishedItemReader();
    const embedder = new FakeEmbedder();
    const index = new FakeChunkIndexRepository();
    reader.add(publishedItem());
    const worker = buildWorker(reader, embedder, index);
    const eventBus = new EventEmitterEventBus();
    worker.subscribe(eventBus);
    const search = new SemanticSearchUseCase(embedder, index);

    await eventBus.publishAll([enrich(new KnowledgeItemPublishedEvent("item-1", 1), "company-1")]);
    await worker.drainOnce();

    await eventBus.publishAll([enrich(new KnowledgeItemDeprecatedEvent("item-1"), "company-1")]);
    await worker.drainOnce();
    const afterDeprecate = await search.execute(SemanticSearchCommand.of("company-1", "refund"));
    assert.equal(afterDeprecate[0]!.stale, true);

    await eventBus.publishAll([enrich(new KnowledgeItemArchivedEvent("item-1"), "company-1")]);
    await worker.drainOnce();
    const afterArchive = await search.execute(SemanticSearchCommand.of("company-1", "refund"));
    assert.equal(afterArchive.length, 0);
  });

  it("ignores an event without a companyId (cannot scope it safely)", async () => {
    const reader = new FakePublishedItemReader();
    const worker = buildWorker(reader, new FakeEmbedder(), new FakeChunkIndexRepository());
    const eventBus = new EventEmitterEventBus();
    worker.subscribe(eventBus);

    await eventBus.publishAll([new KnowledgeItemPublishedEvent("item-1", 1)]);

    assert.equal(worker.pendingCount(), 0);
  });
});
