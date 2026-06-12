import { describe, it, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { UserModule } from "./UserModule.ts";
import { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import { DomainEventManager } from "../../../shared/application/DomainEventManager.ts";
import type { EventPublisherPort } from "../../../shared/ports/EventPublisherPort.ts";
import type { LoggerPort } from "../../../shared/ports/LoggerPort.ts";
import { EventEmitterEventBus } from "../../../shared/infrastructure/events/EventEmitterEventBus.ts";
import { HttpServer } from "../../../shared/infrastructure/http/HttpServer.ts";
import { GraphqlServer } from "../../../shared/infrastructure/graphql/GraphqlServer.ts";
import { InMemoryUserRepository } from "../infrastructure/persistence/in-memory/InMemoryUserRepository.ts";
import { InMemoryUnitOfWork } from "../../../shared/infrastructure/persistence/adapters/InMemoryUnitOfWork.ts";
import { AggregateRoot } from "../../../shared/domain/aggregates/AggregateRoot.ts";
import { AggregateTracker } from "../../../shared/infrastructure/persistence/AggregateTracker.ts";
import { NoOpEventStore } from "../../../shared/infrastructure/persistence/adapters/eventStore/NoOpEventStore.ts";
import { User } from "../domain/aggregates/User.ts";

function createUserRepositoryAdapter(repository: InMemoryUserRepository) {
  return {
    supports: (
      aggregate: AggregateRoot<
        import("../../../shared/domain/identifiers/Identifier.ts").Identifier,
        object
      >,
    ) => aggregate instanceof User,
    save: (
      aggregate: AggregateRoot<
        import("../../../shared/domain/identifiers/Identifier.ts").Identifier,
        object
      >,
    ) => repository.save(aggregate as User),
  };
}

class FakeEventPublisher implements EventPublisherPort {
  public async publish(): Promise<void> {}
  public async publishAll(): Promise<void> {}
}

class FakeLogger implements LoggerPort {
  public messages: Array<{
    level: string;
    message: string;
    context?: Record<string, unknown> | undefined;
  }> = [];

  public info(message: string, context?: Record<string, unknown>): void {
    this.messages.push({ level: "info", message, context });
  }
  public warn(): void {}
  public error(): void {}
  public debug(): void {}
}

const TEST_PORT = 0;

async function fetchJson(
  url: string,
  options?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, options);
  const body = await response.json();
  return { status: response.status, body };
}

describe("UserModule", () => {
  let httpServer: HttpServer;
  let graphqlServer: GraphqlServer;

  beforeEach(() => {
    AggregateRoot.setOnTrack((aggregate) => {
      AggregateTracker.track(aggregate);
    });
  });

  afterEach(async () => {
    AggregateRoot.setOnTrack(null);
    if (httpServer !== undefined) {
      await httpServer.stop();
    }
    if (graphqlServer !== undefined) {
      await graphqlServer.stop();
    }
  });

  it("should register routes and handle POST /users end-to-end", async () => {
    httpServer = new HttpServer();
    const userRepository = new InMemoryUserRepository();
    const unitOfWork = new InMemoryUnitOfWork([createUserRepositoryAdapter(userRepository)]);
    const eventManager = new DomainEventManager();
    const eventPublisher = new FakeEventPublisher();
    const eventStore = new NoOpEventStore();
    const applicationService = new ApplicationService(
      unitOfWork,
      eventManager,
      eventPublisher,
      eventStore,
    );

    const userModule = new UserModule(applicationService, userRepository);
    userModule.registerRoutes(httpServer);

    const port = await httpServer.start(TEST_PORT);

    const result = await fetchJson("http://localhost:" + port + "/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John Doe", email: "john@example.com" }),
    });

    assert.equal(result.status, 201);
    const body = result.body as { id: string; name: string; email: string };
    assert.ok(body.id.length > 0);
    assert.equal(body.name, "John Doe");
    assert.equal(body.email, "john@example.com");
  });

  it("should be self-contained with its own repository instance", async () => {
    httpServer = new HttpServer();
    const userRepository = new InMemoryUserRepository();
    const unitOfWork = new InMemoryUnitOfWork([createUserRepositoryAdapter(userRepository)]);
    const eventManager = new DomainEventManager();
    const eventPublisher = new FakeEventPublisher();
    const eventStore = new NoOpEventStore();
    const applicationService = new ApplicationService(
      unitOfWork,
      eventManager,
      eventPublisher,
      eventStore,
    );

    const userModule = new UserModule(applicationService, userRepository);
    userModule.registerRoutes(httpServer);

    const port = await httpServer.start(TEST_PORT);

    await fetchJson("http://localhost:" + port + "/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John", email: "john@example.com" }),
    });

    const duplicateResult = await fetchJson("http://localhost:" + port + "/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Jane", email: "john@example.com" }),
    });

    assert.equal(duplicateResult.status, 409);
  });

  it("should register GraphQL resolvers and handle createUser mutation", async () => {
    graphqlServer = new GraphqlServer();
    const userRepository = new InMemoryUserRepository();
    const unitOfWork = new InMemoryUnitOfWork([createUserRepositoryAdapter(userRepository)]);
    const eventManager = new DomainEventManager();
    const eventPublisher = new FakeEventPublisher();
    const eventStore = new NoOpEventStore();
    const applicationService = new ApplicationService(
      unitOfWork,
      eventManager,
      eventPublisher,
      eventStore,
    );

    const userModule = new UserModule(applicationService, userRepository);
    userModule.registerResolvers(graphqlServer);

    const port = await graphqlServer.start(TEST_PORT);

    const mutation = `mutation {
      createUser(input: { name: "John Doe", email: "john@example.com" }) {
        id
        name
        email
      }
    }`;

    const result = await fetchJson("http://localhost:" + port + "/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: mutation }),
    });

    assert.equal(result.status, 200);
    const body = result.body as {
      data: { createUser: { id: string; name: string; email: string } };
    };
    assert.ok(body.data.createUser.id.length > 0);
    assert.equal(body.data.createUser.name, "John Doe");
    assert.equal(body.data.createUser.email, "john@example.com");
  });

  it("should register event handlers and react to UserCreated event", async () => {
    httpServer = new HttpServer();
    const userRepository = new InMemoryUserRepository();
    const unitOfWork = new InMemoryUnitOfWork([createUserRepositoryAdapter(userRepository)]);
    const eventManager = new DomainEventManager();
    const eventBus = new EventEmitterEventBus();
    const fakeLogger = new FakeLogger();
    const eventStore = new NoOpEventStore();
    const applicationService = new ApplicationService(
      unitOfWork,
      eventManager,
      eventBus,
      eventStore,
    );

    const userModule = new UserModule(applicationService, userRepository);
    userModule.registerEventHandlers(eventBus, fakeLogger);
    userModule.registerRoutes(httpServer);

    const port = await httpServer.start(TEST_PORT);

    await fetchJson("http://localhost:" + port + "/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John Doe", email: "john@example.com" }),
    });

    const welcomeEmailLog = fakeLogger.messages.find(
      (log) => log.message === "Sending welcome email",
    );
    assert.ok(welcomeEmailLog !== undefined);
    assert.equal((welcomeEmailLog.context as { email: string }).email, "john@example.com");
  });

  it("should handle GET /users/:userId and return user data", async () => {
    httpServer = new HttpServer();
    const userRepository = new InMemoryUserRepository();
    const unitOfWork = new InMemoryUnitOfWork([createUserRepositoryAdapter(userRepository)]);
    const eventManager = new DomainEventManager();
    const eventPublisher = new FakeEventPublisher();
    const eventStore = new NoOpEventStore();
    const applicationService = new ApplicationService(
      unitOfWork,
      eventManager,
      eventPublisher,
      eventStore,
    );

    const userModule = new UserModule(applicationService, userRepository);
    userModule.registerRoutes(httpServer);

    const port = await httpServer.start(TEST_PORT);

    const createResult = await fetchJson("http://localhost:" + port + "/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John Doe", email: "john@example.com" }),
    });

    const userId = (createResult.body as { id: string }).id;

    const getResult = await fetchJson("http://localhost:" + port + "/users/" + userId, {
      method: "GET",
    });

    assert.equal(getResult.status, 200);
    const body = getResult.body as {
      id: string;
      name: string;
      email: string;
      addresses: Array<unknown>;
    };
    assert.equal(body.id, userId);
    assert.equal(body.name, "John Doe");
    assert.equal(body.email, "john@example.com");
    assert.equal(body.addresses.length, 0);
  });

  it("should handle POST /users/:userId/addresses and add an address", async () => {
    httpServer = new HttpServer();
    const userRepository = new InMemoryUserRepository();
    const unitOfWork = new InMemoryUnitOfWork([createUserRepositoryAdapter(userRepository)]);
    const eventManager = new DomainEventManager();
    const eventPublisher = new FakeEventPublisher();
    const eventStore = new NoOpEventStore();
    const applicationService = new ApplicationService(
      unitOfWork,
      eventManager,
      eventPublisher,
      eventStore,
    );

    const userModule = new UserModule(applicationService, userRepository);
    userModule.registerRoutes(httpServer);

    const port = await httpServer.start(TEST_PORT);

    const createResult = await fetchJson("http://localhost:" + port + "/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John Doe", email: "john@example.com" }),
    });

    const userId = (createResult.body as { id: string }).id;

    const addressResult = await fetchJson(
      "http://localhost:" + port + "/users/" + userId + "/addresses",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          street: "Rua A",
          number: "123",
          city: "Sao Paulo",
          state: "SP",
          zipCode: "01000-000",
        }),
      },
    );

    assert.equal(addressResult.status, 201);
    const body = addressResult.body as { userId: string; addressId: string; street: string };
    assert.equal(body.userId, userId);
    assert.ok(body.addressId.length > 0);
    assert.equal(body.street, "Rua A");
  });

  it("should share the same repository between REST and GraphQL adapters", async () => {
    httpServer = new HttpServer();
    graphqlServer = new GraphqlServer();
    const userRepository = new InMemoryUserRepository();
    const unitOfWork = new InMemoryUnitOfWork([createUserRepositoryAdapter(userRepository)]);
    const eventManager = new DomainEventManager();
    const eventPublisher = new FakeEventPublisher();
    const eventStore = new NoOpEventStore();
    const applicationService = new ApplicationService(
      unitOfWork,
      eventManager,
      eventPublisher,
      eventStore,
    );

    const userModule = new UserModule(applicationService, userRepository);
    userModule.registerRoutes(httpServer);
    userModule.registerResolvers(graphqlServer);

    const httpPort = await httpServer.start(TEST_PORT);
    const graphqlPort = await graphqlServer.start(TEST_PORT);

    await fetchJson("http://localhost:" + httpPort + "/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John", email: "john@example.com" }),
    });

    const mutation = `mutation {
      createUser(input: { name: "Jane", email: "john@example.com" }) {
        id
      }
    }`;

    const graphqlResult = await fetchJson("http://localhost:" + graphqlPort + "/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: mutation }),
    });

    assert.equal(graphqlResult.status, 200);
    const body = graphqlResult.body as { errors: Array<{ message: string }> };
    assert.ok(body.errors.length > 0);
    assert.ok(body.errors[0]!.message.includes("already exists"));
  });
});
