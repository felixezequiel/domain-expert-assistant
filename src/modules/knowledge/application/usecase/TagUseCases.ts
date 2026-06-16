import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";
import type { TagRepositoryPort, KnowledgeItemRepositoryPort } from "../types.ts";
import type { CreateTenantTagCommand, RemoveTenantTagCommand } from "../command/TagCommands.ts";
import { Tag } from "../../domain/aggregates/Tag.ts";

export class CreateTenantTagUseCase implements UseCase<CreateTenantTagCommand, Tag> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["admin", "curator"];
  constructor(private readonly tagRepository: TagRepositoryPort) {}

  public async execute(command: CreateTenantTagCommand): Promise<Tag> {
    const companyId = getCurrentActor()?.companyId ?? null;
    if (companyId === null) {
      throw new Error("Cannot create a tag without a tenant in the context");
    }
    const tag = Tag.createTenantTag(command.tagId, companyId, command.label);
    if (await this.tagRepository.existsBySlug(tag.slug)) {
      throw new Error("A tag with this slug already exists: " + tag.slug);
    }
    return tag;
  }
}

export class RemoveTenantTagUseCase implements UseCase<RemoveTenantTagCommand, Tag> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["admin", "curator"];
  constructor(
    private readonly tagRepository: TagRepositoryPort,
    private readonly itemRepository: KnowledgeItemRepositoryPort,
  ) {}

  public async execute(command: RemoveTenantTagCommand): Promise<Tag> {
    const tag = await this.tagRepository.findById(command.tagId);
    if (tag === null) {
      throw new Error("Tag not found: " + command.tagId.value);
    }
    if (await this.itemRepository.isTagInUse(tag.id.value)) {
      throw new Error("Cannot remove a tag that is in use");
    }
    tag.requestRemoval();
    return tag;
  }
}
