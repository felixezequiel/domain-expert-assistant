import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CreateCollectionUseCase, RenameCollectionUseCase } from "./CollectionUseCases.ts";
import { CreateCollectionCommand, RenameCollectionCommand } from "../command/CollectionCommands.ts";
import { FakeCollectionRepository } from "../testDoubles/index.ts";
import { Collection } from "../../domain/aggregates/Collection.ts";
import { CollectionId } from "../../domain/identifiers/CollectionId.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

const ADMIN = { companyId: "company-1", actorId: "admin-1", actorType: "user" as const, roles: ["admin" as const] };

describe("CollectionUseCases", () => {
  it("creates a collection in the actor's tenant", async () => {
    const repo = new FakeCollectionRepository();
    const useCase = new CreateCollectionUseCase(repo);

    const collection = await runWithActor(ADMIN, () => useCase.execute(CreateCollectionCommand.of("c1", "Policies", null)));

    assert.equal(collection.name, "Policies");
    assert.equal(collection.companyId, "company-1");
  });

  it("rejects a duplicate collection name", async () => {
    const repo = new FakeCollectionRepository();
    await repo.save(Collection.create(new CollectionId("c0"), "company-1", "Policies", null, "admin-1"));
    const useCase = new CreateCollectionUseCase(repo);

    await assert.rejects(
      () => runWithActor(ADMIN, () => useCase.execute(CreateCollectionCommand.of("c1", "Policies", null))),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.collectionNameExists");
        assert.equal(error.kind, "validation");
        assert.equal(error.message, "A collection with this name already exists");
        return true;
      },
    );
  });

  it("renames a collection, blocking a clash", async () => {
    const repo = new FakeCollectionRepository();
    await repo.save(Collection.create(new CollectionId("c1"), "company-1", "Old", null, "admin-1"));
    await repo.save(Collection.create(new CollectionId("c2"), "company-1", "Taken", null, "admin-1"));
    const useCase = new RenameCollectionUseCase(repo);

    const renamed = await useCase.execute(RenameCollectionCommand.of("c1", "Fresh"));
    assert.equal(renamed.name, "Fresh");

    await assert.rejects(() => useCase.execute(RenameCollectionCommand.of("c1", "Taken")), /already exists/);
  });
});
