import { AggregateRoot } from "../../../../shared/domain/aggregates/AggregateRoot.ts";
import type { TenantScoped } from "../../../../shared/domain/TenantScoped.ts";
import type { CollectionId } from "../identifiers/CollectionId.ts";
import { CollectionCreatedEvent } from "../events/CollectionCreatedEvent.ts";
import { CollectionRenamedEvent } from "../events/CollectionRenamedEvent.ts";

const MAX_COLLECTION_NAME_LENGTH = 150;

interface CollectionProps {
  readonly companyId: string;
  name: string;
  readonly description: string | null;
  readonly createdBy: string;
}

/**
 * Flat access boundary: a KnowledgeItem belongs to exactly one Collection. Name uniqueness
 * per org is enforced by the repository (index), not here. Deleting a non-empty collection
 * is blocked by a cross-aggregate use case (ADR-013), never by this aggregate.
 */
export class Collection extends AggregateRoot<CollectionId, CollectionProps> implements TenantScoped {
  public get companyId(): string {
    return this.props.companyId;
  }

  public get name(): string {
    return this.props.name;
  }

  public get description(): string | null {
    return this.props.description;
  }

  public get createdBy(): string {
    return this.props.createdBy;
  }

  public static create(
    id: CollectionId,
    companyId: string,
    name: string,
    description: string | null,
    createdBy: string,
  ): Collection {
    const cleanName = Collection.validateName(name);
    const collection = new Collection(id, { companyId, name: cleanName, description, createdBy });
    collection.addDomainEvent(new CollectionCreatedEvent(id.value, cleanName, createdBy));
    return collection;
  }

  public static reconstitute(
    id: CollectionId,
    companyId: string,
    name: string,
    description: string | null,
    createdBy: string,
  ): Collection {
    return new Collection(id, { companyId, name, description, createdBy });
  }

  public rename(name: string): void {
    const cleanName = Collection.validateName(name);
    if (cleanName === this.props.name) {
      return;
    }
    this.props.name = cleanName;
    this.addDomainEvent(new CollectionRenamedEvent(this.id.value, cleanName));
  }

  private static validateName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_COLLECTION_NAME_LENGTH) {
      throw new Error("Collection name must be 1.." + MAX_COLLECTION_NAME_LENGTH + " characters");
    }
    return trimmed;
  }
}
