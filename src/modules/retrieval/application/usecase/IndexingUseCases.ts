import type { UseCase } from "../../../../shared/application/UseCase.ts";
import { chunkText, type ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from "../../domain/chunking/Chunker.ts";
import type {
  EmbedderPort,
  ChunkIndexRepositoryPort,
  PublishedItemReaderPort,
  PublishedItem,
  IndexableChunk,
} from "../types.ts";
import type {
  ProjectItemCommand,
  DeprecateItemIndexCommand,
  RemoveItemFromIndexCommand,
  RebuildIndexCommand,
} from "../command/RetrievalCommands.ts";

/**
 * (Re)projects one published item's chunks into the index (ADR-020 trigger: published
 * pointer set/moved). Idempotent via delete-then-insert in `replaceItemChunks`. The body is
 * chunked (ADR-017), embedded locally, and written with the item's served metadata for scope
 * filtering. A not-served item (never published / archived) is removed instead, so a stale
 * event can never leave orphan chunks. Returns the number of chunks indexed.
 */
export class ProjectItemUseCase implements UseCase<ProjectItemCommand, number> {
  private readonly publishedItemReader: PublishedItemReaderPort;
  private readonly embedder: EmbedderPort;
  private readonly chunkIndex: ChunkIndexRepositoryPort;
  private readonly chunkingOptions: ChunkingOptions;

  constructor(
    publishedItemReader: PublishedItemReaderPort,
    embedder: EmbedderPort,
    chunkIndex: ChunkIndexRepositoryPort,
    chunkingOptions: ChunkingOptions = DEFAULT_CHUNKING_OPTIONS,
  ) {
    this.publishedItemReader = publishedItemReader;
    this.embedder = embedder;
    this.chunkIndex = chunkIndex;
    this.chunkingOptions = chunkingOptions;
  }

  public async execute(command: ProjectItemCommand): Promise<number> {
    const item = await this.publishedItemReader.getPublishedItem(command.itemId);
    if (item === null) {
      return 0;
    }
    return this.project(item);
  }

  public async project(item: PublishedItem): Promise<number> {
    const chunks = chunkText(item.title + "\n\n" + item.body, this.chunkingOptions);
    if (chunks.length === 0) {
      await this.chunkIndex.removeItem(item.companyId, item.itemId);
      return 0;
    }
    const embeddings = await this.embedder.embed(chunks.map((chunk) => chunk.content));
    const indexable: Array<IndexableChunk> = [];
    for (let position = 0; position < chunks.length; position += 1) {
      indexable.push({
        chunkIndex: chunks[position]!.index,
        content: chunks[position]!.content,
        embedding: embeddings[position]!,
      });
    }
    await this.chunkIndex.replaceItemChunks(item.itemId, indexable, {
      companyId: item.companyId,
      collectionId: item.collectionId,
      sensitivity: item.sensitivity,
      title: item.title,
      tagIds: item.tagIds,
      publishedVersion: item.publishedVersion,
      publishedAt: item.publishedAt,
      stale: item.stale,
    });
    return indexable.length;
  }
}

/**
 * Marks a deprecated item's chunks stale (ADR-020): it stays searchable but flagged outdated,
 * so the search lowers freshness/confidence rather than hiding it.
 */
export class DeprecateItemIndexUseCase implements UseCase<DeprecateItemIndexCommand, void> {
  private readonly chunkIndex: ChunkIndexRepositoryPort;
  constructor(chunkIndex: ChunkIndexRepositoryPort) {
    this.chunkIndex = chunkIndex;
  }
  public async execute(command: DeprecateItemIndexCommand): Promise<void> {
    await this.chunkIndex.markItemStale(command.companyId, command.itemId);
  }
}

/** Removes an archived item's chunks from the index (ADR-020). Idempotent. */
export class RemoveItemFromIndexUseCase implements UseCase<RemoveItemFromIndexCommand, void> {
  private readonly chunkIndex: ChunkIndexRepositoryPort;
  constructor(chunkIndex: ChunkIndexRepositoryPort) {
    this.chunkIndex = chunkIndex;
  }
  public async execute(command: RemoveItemFromIndexCommand): Promise<void> {
    await this.chunkIndex.removeItem(command.companyId, command.itemId);
  }
}

/**
 * Rebuilds a tenant's whole index from its served items (ADR-020): the index is 100% derived,
 * so this cures any transient projection failure. Reprojects every served item idempotently
 * and returns how many were reprojected.
 */
export class RebuildIndexUseCase implements UseCase<RebuildIndexCommand, number> {
  private readonly publishedItemReader: PublishedItemReaderPort;
  private readonly projectItem: ProjectItemUseCase;

  constructor(publishedItemReader: PublishedItemReaderPort, projectItem: ProjectItemUseCase) {
    this.publishedItemReader = publishedItemReader;
    this.projectItem = projectItem;
  }

  public async execute(command: RebuildIndexCommand): Promise<number> {
    const items = await this.publishedItemReader.listServedItems(command.companyId);
    for (const item of items) {
      await this.projectItem.project(item);
    }
    return items.length;
  }
}
