import type { EntityManagerProvider } from "../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { AggregatePersister } from "../../../shared/infrastructure/persistence/AggregatePersister.ts";
import type { InfrastructureResult } from "../../../shared/factories/index.ts";
import type { LoggerPort } from "../../../shared/ports/LoggerPort.ts";
import { MikroOrmAggregatePersister } from "../../../shared/infrastructure/persistence/adapters/MikroOrmAggregatePersister.ts";
import type { ResolveSessionUseCase } from "../../identity/application/usecase/ResolveSessionUseCase.ts";

import { IngestionJob } from "../domain/aggregates/IngestionJob.ts";
import { IngestionJobEntity } from "../infrastructure/persistence/mikro-orm/entities/IngestionJobEntity.ts";
import { IngestionJobMapper } from "../infrastructure/persistence/mikro-orm/mappers/IngestionJobMapper.ts";
import { MikroOrmIngestionJobRepository } from "../infrastructure/persistence/mikro-orm/repositories/MikroOrmIngestionJobRepository.ts";
import { LocalFileStorage } from "../infrastructure/storage/LocalFileStorage.ts";
import { PlainTextExtractor } from "../infrastructure/extractors/PlainTextExtractor.ts";
import { CreateDraftFromDocumentAdapter } from "../infrastructure/knowledge/CreateDraftFromDocumentAdapter.ts";
import { IngestionWorker } from "../infrastructure/worker/IngestionWorker.ts";
import { UploadDocumentUseCase } from "../application/usecase/UploadDocumentUseCase.ts";
import { ProcessIngestionJobUseCase } from "../application/usecase/ProcessIngestionJobUseCase.ts";
import { GetIngestionJobUseCase } from "../application/usecase/GetIngestionJobUseCase.ts";
import { RecoverStuckJobsUseCase } from "../application/usecase/RecoverStuckJobsUseCase.ts";
import { IngestionModule } from "../bootstrap/IngestionModule.ts";

import { CreateKnowledgeItemUseCase } from "../../knowledge/application/usecase/CreateKnowledgeItemUseCase.ts";
import { KnowledgeItemRepository } from "../../knowledge/infrastructure/persistence/mikro-orm/repositories/KnowledgeItemRepository.ts";
import { CollectionRepository } from "../../knowledge/infrastructure/persistence/mikro-orm/repositories/CollectionRepository.ts";
import { TagRepository } from "../../knowledge/infrastructure/persistence/mikro-orm/repositories/TagRepository.ts";
import { KnowledgeVersionRepository } from "../../knowledge/infrastructure/persistence/mikro-orm/repositories/KnowledgeVersionRepository.ts";

const WORKER_INTERVAL_MS = 2000;

export interface IngestionModuleDependencies {
  readonly resolveSession: ResolveSessionUseCase;
}

export interface IngestionModuleSetup {
  readonly persisters: ReadonlyArray<AggregatePersister>;
  register(infrastructure: InfrastructureResult, logger: LoggerPort): void;
}

export class IngestionModuleFactory {
  public static create(
    entityManagerProvider: EntityManagerProvider,
    dependencies: IngestionModuleDependencies,
  ): IngestionModuleSetup {
    const jobRepository = new MikroOrmIngestionJobRepository(entityManagerProvider);
    const fileStorage = new LocalFileStorage();
    const extractors = [new PlainTextExtractor()];

    // The worker turns an extracted document into a Knowledge draft via Knowledge's own use
    // case, sharing the unit-of-work transaction (the item + its v1 snapshot commit with the job).
    const createKnowledgeItem = new CreateKnowledgeItemUseCase(
      new KnowledgeItemRepository(entityManagerProvider),
      new CollectionRepository(entityManagerProvider),
      new TagRepository(entityManagerProvider),
      new KnowledgeVersionRepository(entityManagerProvider),
    );
    const knowledgeDraftCreation = new CreateDraftFromDocumentAdapter(createKnowledgeItem);

    const uploadDocument = new UploadDocumentUseCase(fileStorage);
    const processIngestionJob = new ProcessIngestionJobUseCase(
      jobRepository,
      fileStorage,
      extractors,
      knowledgeDraftCreation,
    );
    const getIngestionJob = new GetIngestionJobUseCase(jobRepository);
    const recoverStuckJobs = new RecoverStuckJobsUseCase(jobRepository);

    const persisters: ReadonlyArray<AggregatePersister> = [
      new MikroOrmAggregatePersister({
        aggregateClass: IngestionJob,
        ormEntityClass: IngestionJobEntity,
        toOrmEntity: (job: IngestionJob) => IngestionJobMapper.toOrmEntity(job),
        getNestedEntities: (): Array<object> => [],
      }),
    ];

    return {
      persisters,
      register(infrastructure: InfrastructureResult, _logger: LoggerPort): void {
        const ingestionModule = new IngestionModule({
          applicationService: infrastructure.applicationService,
          resolveSession: dependencies.resolveSession,
          uploadDocument,
          getIngestionJob,
        });
        ingestionModule.registerRoutes(infrastructure.httpServer);

        const worker = new IngestionWorker(
          infrastructure.applicationService,
          jobRepository,
          processIngestionJob,
          recoverStuckJobs,
        );
        // Recover crashed-mid-run jobs, then start draining the queue (ADR-015).
        void worker.recover().finally(() => worker.start(WORKER_INTERVAL_MS));
      },
    };
  }
}
