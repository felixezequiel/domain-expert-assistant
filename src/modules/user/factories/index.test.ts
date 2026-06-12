import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserModuleFactory } from "./index.ts";
import { MikroOrmAggregatePersister } from "../../../shared/infrastructure/persistence/adapters/MikroOrmAggregatePersister.ts";
import type { EntityManagerProvider } from "../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { InfrastructureResult } from "../../../shared/factories/index.ts";
import { HttpServer } from "../../../shared/infrastructure/http/HttpServer.ts";
import { GraphqlServer } from "../../../shared/infrastructure/graphql/GraphqlServer.ts";
import { EventEmitterEventBus } from "../../../shared/infrastructure/events/EventEmitterEventBus.ts";
import type { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import type { MikroOrmUnitOfWork } from "../../../shared/infrastructure/persistence/adapters/MikroOrmUnitOfWork.ts";
import type { DomainEventManager } from "../../../shared/application/DomainEventManager.ts";
import type { LoggerPort } from "../../../shared/ports/LoggerPort.ts";
import { SseService } from "../../../shared/infrastructure/sse/SseService.ts";

function createFakeEntityManagerProvider(): EntityManagerProvider {
  return {
    getEntityManager() {
      return {} as ReturnType<EntityManagerProvider["getEntityManager"]>;
    },
    setEntityManager() {},
    runWithScope<T>(callback: () => Promise<T>): Promise<T> {
      return callback();
    },
  };
}

function createFakeLogger(): LoggerPort {
  return {
    info() {},
    warn() {},
    error() {},
    debug() {},
  };
}

function createFakeInfrastructure(): InfrastructureResult {
  const eventBus = new EventEmitterEventBus();
  const httpServer = new HttpServer();
  const graphqlServer = new GraphqlServer();

  return {
    unitOfWork: {} as MikroOrmUnitOfWork,
    domainEventManager: {} as DomainEventManager,
    eventBus,
    applicationService: {} as ApplicationService,
    httpServer,
    graphqlServer,
    sseService: new SseService(),
  };
}

describe("UserModuleFactory", () => {
  describe("create", () => {
    it("should return persisters array with one MikroOrmAggregatePersister", () => {
      const entityManagerProvider = createFakeEntityManagerProvider();

      const result = UserModuleFactory.create(entityManagerProvider);

      const EXPECTED_PERSISTER_COUNT = 1;
      assert.equal(result.persisters.length, EXPECTED_PERSISTER_COUNT);
      assert.ok(result.persisters[0] instanceof MikroOrmAggregatePersister);
    });
  });

  describe("register", () => {
    it("should register event handlers on the event bus", () => {
      const entityManagerProvider = createFakeEntityManagerProvider();
      const infrastructure = createFakeInfrastructure();
      const logger = createFakeLogger();

      const userModule = UserModuleFactory.create(entityManagerProvider);
      userModule.register(infrastructure, logger);

      const EXPECTED_SUBSCRIBER_COUNT = 1;
      const subscriberCount = infrastructure.eventBus.subscriberCount("UserCreated");
      assert.equal(subscriberCount, EXPECTED_SUBSCRIBER_COUNT);
    });

    it("should register HTTP routes on the http server", () => {
      const entityManagerProvider = createFakeEntityManagerProvider();
      const infrastructure = createFakeInfrastructure();
      const logger = createFakeLogger();

      const userModule = UserModuleFactory.create(entityManagerProvider);
      userModule.register(infrastructure, logger);

      const EXPECTED_ROUTE_COUNT = 3;
      const routeCount = infrastructure.httpServer.routeCount;
      assert.equal(routeCount, EXPECTED_ROUTE_COUNT);
    });

    it("should register GraphQL resolvers on the graphql server", () => {
      const entityManagerProvider = createFakeEntityManagerProvider();
      const infrastructure = createFakeInfrastructure();
      const logger = createFakeLogger();

      const userModule = UserModuleFactory.create(entityManagerProvider);
      userModule.register(infrastructure, logger);

      const EXPECTED_SCHEMA_FRAGMENT_COUNT = 1;
      const schemaFragmentCount = infrastructure.graphqlServer.schemaFragmentCount;
      assert.equal(schemaFragmentCount, EXPECTED_SCHEMA_FRAGMENT_COUNT);
    });
  });
});
