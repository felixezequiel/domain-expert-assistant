import type { EntityManagerProvider } from "../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { InfrastructureResult } from "../../../shared/factories/index.ts";
import type { LoggerPort } from "../../../shared/ports/LoggerPort.ts";
import type { ResolveSessionUseCase } from "../../identity/application/usecase/ResolveSessionUseCase.ts";

import { MikroOrmChunkIndexRepository } from "../infrastructure/persistence/mikro-orm/repositories/MikroOrmChunkIndexRepository.ts";
import { TransformersEmbedder } from "../infrastructure/embedding/TransformersEmbedder.ts";
import { PublishedItemReaderAdapter } from "../infrastructure/knowledge/PublishedItemReaderAdapter.ts";
import { IndexProjectionWorker } from "../infrastructure/worker/IndexProjectionWorker.ts";
import {
  ProjectItemUseCase,
  DeprecateItemIndexUseCase,
  RemoveItemFromIndexUseCase,
  RebuildIndexUseCase,
} from "../application/usecase/IndexingUseCases.ts";
import { SemanticSearchUseCase } from "../application/usecase/SemanticSearchUseCase.ts";
import { RetrievalModule } from "../bootstrap/RetrievalModule.ts";
import type { EmbedderPort } from "../application/types.ts";

import { KnowledgeItemRepository } from "../../knowledge/infrastructure/persistence/mikro-orm/repositories/KnowledgeItemRepository.ts";
import { KnowledgeVersionRepository } from "../../knowledge/infrastructure/persistence/mikro-orm/repositories/KnowledgeVersionRepository.ts";
import {
  GetKnowledgeItemUseCase,
  ListKnowledgeItemsUseCase,
  GetVersionHistoryUseCase,
} from "../../knowledge/application/usecase/KnowledgeQueries.ts";

const PROJECTION_INTERVAL_MS = 1000;

export interface RetrievalModuleDependencies {
  readonly resolveSession: ResolveSessionUseCase;
  // Lets tests/benchmarks inject a deterministic embedder; production uses the local BGE-M3 model.
  readonly embedder?: EmbedderPort;
}

export interface RetrievalModuleSetup {
  register(infrastructure: InfrastructureResult, logger: LoggerPort): void;
}

/**
 * Composition for the Retrieval & Indexing slice (PRD-4). The chunk index is a derived
 * read-model, so this module owns no aggregate and contributes no persister. Embedding is the
 * local BGE-M3 adapter (ADR-017); the published-item reader bridges onto Knowledge's read
 * queries; and the projection worker subscribes to Knowledge's lifecycle events on the shared
 * EventBus and drains them async in a per-tenant system scope (ADR-020).
 */
export class RetrievalModuleFactory {
  public static create(
    entityManagerProvider: EntityManagerProvider,
    dependencies: RetrievalModuleDependencies,
  ): RetrievalModuleSetup {
    const chunkIndex = new MikroOrmChunkIndexRepository(entityManagerProvider);
    const embedder = dependencies.embedder ?? new TransformersEmbedder();

    const publishedItemReader = new PublishedItemReaderAdapter(
      new GetKnowledgeItemUseCase(new KnowledgeItemRepository(entityManagerProvider)),
      new ListKnowledgeItemsUseCase(new KnowledgeItemRepository(entityManagerProvider)),
      new GetVersionHistoryUseCase(new KnowledgeVersionRepository(entityManagerProvider)),
    );

    const projectItem = new ProjectItemUseCase(publishedItemReader, embedder, chunkIndex);
    const deprecateItem = new DeprecateItemIndexUseCase(chunkIndex);
    const removeItem = new RemoveItemFromIndexUseCase(chunkIndex);
    const rebuildIndex = new RebuildIndexUseCase(publishedItemReader, projectItem);
    const semanticSearch = new SemanticSearchUseCase(embedder, chunkIndex);

    return {
      register(infrastructure: InfrastructureResult, _logger: LoggerPort): void {
        const retrievalModule = new RetrievalModule({
          applicationService: infrastructure.applicationService,
          resolveSession: dependencies.resolveSession,
          semanticSearch,
          rebuildIndex,
        });
        retrievalModule.registerRoutes(infrastructure.httpServer);

        const worker = new IndexProjectionWorker(
          infrastructure.applicationService,
          projectItem,
          deprecateItem,
          removeItem,
        );
        // Subscribe to the publish/deprecate/archive signals, then drain async (ADR-020):
        // the subscriber only enqueues, so the publish transaction never blocks on indexing.
        worker.subscribe(infrastructure.eventBus);
        worker.start(PROJECTION_INTERVAL_MS);
      },
    };
  }
}
