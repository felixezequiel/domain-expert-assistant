import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";
import type { CollectionRepositoryPort } from "../types.ts";
import type { CreateCollectionCommand, RenameCollectionCommand } from "../command/CollectionCommands.ts";
import { Collection } from "../../domain/aggregates/Collection.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

export class CreateCollectionUseCase implements UseCase<CreateCollectionCommand, Collection> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["admin"];
  constructor(private readonly collectionRepository: CollectionRepositoryPort) {}

  public async execute(command: CreateCollectionCommand): Promise<Collection> {
    const actor = getCurrentActor();
    const companyId = actor?.companyId ?? null;
    const createdBy = actor?.actorId ?? null;
    if (companyId === null || createdBy === null) {
      throw new DomainError(
        "knowledge.missingTenantActor",
        "validation",
        undefined,
        "Cannot create a collection without a tenant/actor in the context",
      );
    }
    if (await this.collectionRepository.existsByName(command.name.trim())) {
      throw new DomainError(
        "knowledge.collectionNameExists",
        "validation",
        undefined,
        "A collection with this name already exists",
      );
    }
    return Collection.create(command.collectionId, companyId, command.name, command.description, createdBy);
  }
}

export class RenameCollectionUseCase implements UseCase<RenameCollectionCommand, Collection> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["admin"];
  constructor(private readonly collectionRepository: CollectionRepositoryPort) {}

  public async execute(command: RenameCollectionCommand): Promise<Collection> {
    const collection = await this.collectionRepository.findById(command.collectionId);
    if (collection === null) {
      throw new DomainError(
        "knowledge.collectionNotFound",
        "validation",
        { id: command.collectionId.value },
        "Collection not found: " + command.collectionId.value,
      );
    }
    const newName = command.name.trim();
    if (newName !== collection.name && (await this.collectionRepository.existsByName(newName))) {
      throw new DomainError(
        "knowledge.collectionNameExists",
        "validation",
        undefined,
        "A collection with this name already exists",
      );
    }
    collection.rename(command.name);
    return collection;
  }
}
