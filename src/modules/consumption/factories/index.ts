import type { EntityManagerProvider } from "../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { InfrastructureResult } from "../../../shared/factories/index.ts";
import type { LoggerPort } from "../../../shared/ports/LoggerPort.ts";

import { MikroOrmConsumerCredentialRepository } from "../../identity/infrastructure/persistence/mikro-orm/repositories/MikroOrmConsumerCredentialRepository.ts";
import { Sha256OpaqueSecret } from "../../identity/infrastructure/auth/Sha256OpaqueSecret.ts";
import { AuthenticateConsumerUseCase } from "../../identity/application/usecase/AuthenticateConsumerUseCase.ts";

import { MikroOrmChunkIndexRepository } from "../../retrieval/infrastructure/persistence/mikro-orm/repositories/MikroOrmChunkIndexRepository.ts";
import { TransformersEmbedder } from "../../retrieval/infrastructure/embedding/TransformersEmbedder.ts";
import { SemanticSearchUseCase } from "../../retrieval/application/usecase/SemanticSearchUseCase.ts";
import type { EmbedderPort } from "../../retrieval/application/types.ts";

import { KnowledgeItemRepository } from "../../knowledge/infrastructure/persistence/mikro-orm/repositories/KnowledgeItemRepository.ts";
import { CollectionRepository } from "../../knowledge/infrastructure/persistence/mikro-orm/repositories/CollectionRepository.ts";
import { TagRepository } from "../../knowledge/infrastructure/persistence/mikro-orm/repositories/TagRepository.ts";
import {
  GetKnowledgeItemUseCase,
  ListKnowledgeItemsUseCase,
  ListCollectionsUseCase,
  ListTagsUseCase,
} from "../../knowledge/application/usecase/KnowledgeQueries.ts";

import { ScopeResolver } from "../application/service/ScopeResolver.ts";
import { KnowledgeQueryFacade } from "../application/service/KnowledgeQueryFacade.ts";
import { RecordCredentialUsageUseCase } from "../application/usecase/RecordCredentialUsageUseCase.ts";
import { TrackerCredentialUsageStager } from "../infrastructure/persistence/TrackerCredentialUsageStager.ts";
import { FixedWindowRateLimiter } from "../infrastructure/http/RateLimiter.ts";
import { ConsumptionModule } from "../bootstrap/ConsumptionModule.ts";

const RATE_LIMIT_MAX_REQUESTS = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

export interface ConsumptionModuleDependencies {
  // The composition root shares a single embedder across Retrieval (projection) and
  // Consumption (search) so the BGE-M3 model is loaded once. Tests inject a fake.
  readonly embedder?: EmbedderPort;
}

export interface ConsumptionModuleSetup {
  register(infrastructure: InfrastructureResult, logger: LoggerPort): void;
}

/**
 * Composition for the Consumption Gateway (PRD-5, the consumer-facing interface layer). The
 * gateway owns no aggregate — it only stages a credential `lastUsedAt` mutation through the
 * shared UnitOfWork. It builds its own instances of Identity's consumer auth, Retrieval's
 * semantic search, and Knowledge's read queries (importing the concrete classes directly,
 * like the Ingestion/Retrieval factories do) and wires them behind one `KnowledgeQueryFacade`
 * so the REST and MCP surfaces enforce the same scope and return identical data (ADR-021/022).
 */
export class ConsumptionModuleFactory {
  public static create(
    entityManagerProvider: EntityManagerProvider,
    dependencies: ConsumptionModuleDependencies = {},
  ): ConsumptionModuleSetup {
    const credentialRepository = new MikroOrmConsumerCredentialRepository(entityManagerProvider);
    const opaqueSecret = new Sha256OpaqueSecret();
    const authenticateConsumer = new AuthenticateConsumerUseCase(credentialRepository, opaqueSecret);

    const usageStager = new TrackerCredentialUsageStager();
    const recordCredentialUsage = new RecordCredentialUsageUseCase(credentialRepository, usageStager);

    const chunkIndex = new MikroOrmChunkIndexRepository(entityManagerProvider);
    const embedder = dependencies.embedder ?? new TransformersEmbedder();
    const semanticSearch = new SemanticSearchUseCase(embedder, chunkIndex);

    const itemRepository = new KnowledgeItemRepository(entityManagerProvider);
    const collectionRepository = new CollectionRepository(entityManagerProvider);
    const tagRepository = new TagRepository(entityManagerProvider);

    const scopeResolver = new ScopeResolver();

    return {
      register(infrastructure: InfrastructureResult, logger: LoggerPort): void {
        // The facade runs every read through the shared ApplicationService, so each opens the
        // unit of work in the consumer's actor scope (→ tenant filter, ADR-009/022).
        const knowledgeQueryFacade = new KnowledgeQueryFacade(
          scopeResolver,
          infrastructure.applicationService,
          {
            semanticSearch,
            getItem: new GetKnowledgeItemUseCase(itemRepository),
            listItems: new ListKnowledgeItemsUseCase(itemRepository),
            listCollections: new ListCollectionsUseCase(collectionRepository),
            listTags: new ListTagsUseCase(tagRepository),
          },
        );
        const rateLimiter = new FixedWindowRateLimiter(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);

        const consumptionModule = new ConsumptionModule({
          applicationService: infrastructure.applicationService,
          authenticateConsumer,
          knowledgeQueryFacade,
          recordCredentialUsage,
          rateLimiter,
          logger,
        });
        consumptionModule.registerRoutes(infrastructure.httpServer);
      },
    };
  }
}
