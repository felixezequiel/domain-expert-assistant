import { MikroORM } from "@mikro-orm/sqlite";
import type { LoggerPort } from "../ports/LoggerPort.ts";
import type { AggregatePersister } from "../infrastructure/persistence/AggregatePersister.ts";
import type { EntityManagerProvider } from "../infrastructure/persistence/adapters/EntityManagerProvider.ts";
import { MikroOrmEntityManagerProvider } from "../infrastructure/persistence/adapters/EntityManagerProvider.ts";
import { AggregateRoot } from "../domain/aggregates/AggregateRoot.ts";
import { AggregateTracker } from "../infrastructure/persistence/AggregateTracker.ts";
import { EventEmittingAdapter } from "../infrastructure/adapters/EventEmittingAdapter.ts";
import { MikroOrmUnitOfWork } from "../infrastructure/persistence/adapters/MikroOrmUnitOfWork.ts";
import { DomainEventManager } from "../application/DomainEventManager.ts";
import { EventEmitterEventBus } from "../infrastructure/events/EventEmitterEventBus.ts";
import { ApplicationService } from "../application/ApplicationService.ts";
import { MikroOrmEventStore } from "../infrastructure/persistence/adapters/eventStore/MikroOrmEventStore.ts";
import { HttpServer } from "../infrastructure/http/HttpServer.ts";
import { GraphqlServer } from "../infrastructure/graphql/GraphqlServer.ts";
import { SseService } from "../infrastructure/sse/SseService.ts";
import { SseBroadcaster } from "../infrastructure/sse/SseBroadcaster.ts";
import mikroOrmConfig from "../../mikro-orm.config.ts";

export class DatabaseFactory {
  public static async create(logger: LoggerPort): Promise<EntityManagerProvider> {
    const orm = await MikroORM.init(mikroOrmConfig);
    const migrator = orm.migrator;
    await migrator.up();
    logger.info("Database migrations applied");

    AggregateRoot.setOnTrack((aggregate) => {
      AggregateTracker.track(aggregate);
    });

    EventEmittingAdapter.setOnTrack((source) => {
      AggregateTracker.track(source);
    });

    const entityManagerProvider = new MikroOrmEntityManagerProvider(orm.em);
    return entityManagerProvider;
  }
}

export interface InfrastructureResult {
  readonly unitOfWork: MikroOrmUnitOfWork;
  readonly domainEventManager: DomainEventManager;
  readonly eventBus: EventEmitterEventBus;
  readonly applicationService: ApplicationService;
  readonly httpServer: HttpServer;
  readonly graphqlServer: GraphqlServer;
  readonly sseService: SseService;
}

export class InfrastructureFactory {
  public static create(
    entityManagerProvider: EntityManagerProvider,
    persisters: ReadonlyArray<AggregatePersister>,
  ): InfrastructureResult {
    const unitOfWork = new MikroOrmUnitOfWork(entityManagerProvider, persisters);
    const domainEventManager = new DomainEventManager();
    const eventBus = new EventEmitterEventBus();
    const eventStore = new MikroOrmEventStore(entityManagerProvider);
    const sseService = new SseService();
    const sseBroadcaster = new SseBroadcaster(sseService);
    const applicationService = new ApplicationService(
      unitOfWork,
      domainEventManager,
      eventBus,
      eventStore,
      sseBroadcaster,
      (fn) => entityManagerProvider.runWithScope(fn),
    );
    const httpServer = new HttpServer();
    const graphqlServer = new GraphqlServer();

    return {
      unitOfWork,
      domainEventManager,
      eventBus,
      applicationService,
      httpServer,
      graphqlServer,
      sseService,
    };
  }
}
