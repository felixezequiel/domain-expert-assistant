import type { EntityManagerProvider } from "../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { AggregatePersister } from "../../../shared/infrastructure/persistence/AggregatePersister.ts";
import type { InfrastructureResult } from "../../../shared/factories/index.ts";
import type { LoggerPort } from "../../../shared/ports/LoggerPort.ts";
import { MikroOrmAggregatePersister } from "../../../shared/infrastructure/persistence/adapters/MikroOrmAggregatePersister.ts";

import type { SessionResolverPort } from "../../../shared/application/ports/SessionResolverPort.ts";
import type { OrganizationPolicyPort } from "../application/types.ts";
import type { UserDirectoryPort } from "../../../shared/ports/UserDirectoryPort.ts";

import { KnowledgeItem } from "../domain/aggregates/KnowledgeItem.ts";
import { Collection } from "../domain/aggregates/Collection.ts";
import { Tag } from "../domain/aggregates/Tag.ts";

import { KnowledgeItemEntity } from "../infrastructure/persistence/mikro-orm/entities/KnowledgeItemEntity.ts";
import { CollectionEntity } from "../infrastructure/persistence/mikro-orm/entities/CollectionEntity.ts";
import { TagEntity } from "../infrastructure/persistence/mikro-orm/entities/TagEntity.ts";
import { KnowledgeItemMapper } from "../infrastructure/persistence/mikro-orm/mappers/KnowledgeItemMapper.ts";
import { CollectionMapper } from "../infrastructure/persistence/mikro-orm/mappers/CollectionMapper.ts";
import { TagMapper } from "../infrastructure/persistence/mikro-orm/mappers/TagMapper.ts";
import { KnowledgeItemRepository } from "../infrastructure/persistence/mikro-orm/repositories/KnowledgeItemRepository.ts";
import { CollectionRepository } from "../infrastructure/persistence/mikro-orm/repositories/CollectionRepository.ts";
import { TagRepository } from "../infrastructure/persistence/mikro-orm/repositories/TagRepository.ts";
import { KnowledgeVersionRepository } from "../infrastructure/persistence/mikro-orm/repositories/KnowledgeVersionRepository.ts";

import { CreateKnowledgeItemUseCase } from "../application/usecase/CreateKnowledgeItemUseCase.ts";
import { EditKnowledgeItemUseCase } from "../application/usecase/EditKnowledgeItemUseCase.ts";
import {
  SubmitForReviewUseCase,
  ApproveItemUseCase,
  RejectItemUseCase,
  DeprecateItemUseCase,
  ArchiveItemUseCase,
} from "../application/usecase/LifecycleUseCases.ts";
import {
  RollbackToVersionUseCase,
  RetagItemUseCase,
  MoveItemToCollectionUseCase,
} from "../application/usecase/ItemContentUseCases.ts";
import { CreateCollectionUseCase, RenameCollectionUseCase } from "../application/usecase/CollectionUseCases.ts";
import { CreateTenantTagUseCase, RemoveTenantTagUseCase } from "../application/usecase/TagUseCases.ts";
import {
  GetKnowledgeItemUseCase,
  ListKnowledgeItemsUseCase,
  GetVersionHistoryUseCase,
  ListCollectionsUseCase,
  ListTagsUseCase,
} from "../application/usecase/KnowledgeQueries.ts";

import { KnowledgeModule } from "../bootstrap/KnowledgeModule.ts";

export interface KnowledgeModuleDependencies {
  readonly sessionResolver: SessionResolverPort;
  readonly organizationPolicy: OrganizationPolicyPort;
  // Resolves version-history author ids to display names (ADR-013-style cross-module read).
  readonly userDirectory: UserDirectoryPort;
}

export interface KnowledgeModuleSetup {
  readonly persisters: ReadonlyArray<AggregatePersister>;
  register(infrastructure: InfrastructureResult, logger: LoggerPort): void;
}

export class KnowledgeModuleFactory {
  public static create(
    entityManagerProvider: EntityManagerProvider,
    deps: KnowledgeModuleDependencies,
  ): KnowledgeModuleSetup {
    const itemRepository = new KnowledgeItemRepository(entityManagerProvider);
    const collectionRepository = new CollectionRepository(entityManagerProvider);
    const tagRepository = new TagRepository(entityManagerProvider);
    const versionRepository = new KnowledgeVersionRepository(entityManagerProvider);

    // KnowledgeVersion is appended through its repository inside the item's transaction
    // (ADR-012), not as an aggregate — so it has no persister.
    const persisters: ReadonlyArray<AggregatePersister> = [
      new MikroOrmAggregatePersister({
        aggregateClass: KnowledgeItem,
        ormEntityClass: KnowledgeItemEntity,
        toOrmEntity: (item: KnowledgeItem) => KnowledgeItemMapper.toOrmEntity(item),
        getNestedEntities: (): Array<object> => [],
      }),
      new MikroOrmAggregatePersister({
        aggregateClass: Collection,
        ormEntityClass: CollectionEntity,
        toOrmEntity: (collection: Collection) => CollectionMapper.toOrmEntity(collection),
        getNestedEntities: (): Array<object> => [],
      }),
      new MikroOrmAggregatePersister({
        aggregateClass: Tag,
        ormEntityClass: TagEntity,
        toOrmEntity: (tag: Tag) => TagMapper.toOrmEntity(tag),
        getNestedEntities: (): Array<object> => [],
      }),
    ];

    return {
      persisters,
      register(infrastructure: InfrastructureResult, _logger: LoggerPort): void {
        const knowledgeModule = new KnowledgeModule({
          applicationService: infrastructure.applicationService,
          sessionResolver: deps.sessionResolver,
          createKnowledgeItem: new CreateKnowledgeItemUseCase(
            itemRepository,
            collectionRepository,
            tagRepository,
            versionRepository,
          ),
          editKnowledgeItem: new EditKnowledgeItemUseCase(itemRepository, versionRepository),
          submitForReview: new SubmitForReviewUseCase(itemRepository),
          approveItem: new ApproveItemUseCase(itemRepository, deps.organizationPolicy),
          rejectItem: new RejectItemUseCase(itemRepository),
          deprecateItem: new DeprecateItemUseCase(itemRepository),
          archiveItem: new ArchiveItemUseCase(itemRepository),
          rollbackToVersion: new RollbackToVersionUseCase(itemRepository, versionRepository),
          retagItem: new RetagItemUseCase(itemRepository, tagRepository, versionRepository),
          moveItemToCollection: new MoveItemToCollectionUseCase(itemRepository, collectionRepository),
          createCollection: new CreateCollectionUseCase(collectionRepository),
          renameCollection: new RenameCollectionUseCase(collectionRepository),
          createTenantTag: new CreateTenantTagUseCase(tagRepository),
          removeTenantTag: new RemoveTenantTagUseCase(tagRepository, itemRepository),
          getKnowledgeItem: new GetKnowledgeItemUseCase(itemRepository),
          listKnowledgeItems: new ListKnowledgeItemsUseCase(itemRepository),
          getVersionHistory: new GetVersionHistoryUseCase(versionRepository, deps.userDirectory),
          listCollections: new ListCollectionsUseCase(collectionRepository),
          listTags: new ListTagsUseCase(tagRepository),
        });

        knowledgeModule.registerRoutes(infrastructure.httpServer);
      },
    };
  }
}
