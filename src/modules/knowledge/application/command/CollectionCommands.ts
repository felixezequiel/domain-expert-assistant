import { CollectionId } from "../../domain/identifiers/CollectionId.ts";

export class CreateCollectionCommand {
  public readonly collectionId: CollectionId;
  public readonly name: string;
  public readonly description: string | null;

  private constructor(collectionId: CollectionId, name: string, description: string | null) {
    this.collectionId = collectionId;
    this.name = name;
    this.description = description;
  }

  public static of(collectionId: string, name: string, description: string | null): CreateCollectionCommand {
    return new CreateCollectionCommand(new CollectionId(collectionId), name, description);
  }
}

export class RenameCollectionCommand {
  public readonly collectionId: CollectionId;
  public readonly name: string;

  private constructor(collectionId: CollectionId, name: string) {
    this.collectionId = collectionId;
    this.name = name;
  }

  public static of(collectionId: string, name: string): RenameCollectionCommand {
    return new RenameCollectionCommand(new CollectionId(collectionId), name);
  }
}
