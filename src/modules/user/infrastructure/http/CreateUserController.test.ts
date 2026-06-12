import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { CreateUserController } from "./CreateUserController.ts";
import { ApplicationService } from "../../../../shared/application/ApplicationService.ts";
import { DomainEventManager } from "../../../../shared/application/DomainEventManager.ts";
import type { EventPublisherPort } from "../../../../shared/ports/EventPublisherPort.ts";
import { CreateUserUseCase } from "../../application/usecase/CreateUserUseCase.ts";
import { InMemoryUserRepository } from "../persistence/in-memory/InMemoryUserRepository.ts";
import { InMemoryUnitOfWork } from "../../../../shared/infrastructure/persistence/adapters/InMemoryUnitOfWork.ts";
import { AggregateRoot } from "../../../../shared/domain/aggregates/AggregateRoot.ts";
import { AggregateTracker } from "../../../../shared/infrastructure/persistence/AggregateTracker.ts";
import { NoOpEventStore } from "../../../../shared/infrastructure/persistence/adapters/eventStore/NoOpEventStore.ts";
import { User } from "../../domain/aggregates/User.ts";

class FakeEventPublisher implements EventPublisherPort {
  public async publish(): Promise<void> {}
  public async publishAll(): Promise<void> {}
}

function createTestDependencies() {
  const userRepository = new InMemoryUserRepository();
  const unitOfWork = new InMemoryUnitOfWork([
    {
      supports: (aggregate) => aggregate instanceof User,
      save: (aggregate) => userRepository.save(aggregate as User),
    },
  ]);
  const eventManager = new DomainEventManager();
  const eventPublisher = new FakeEventPublisher();
  const eventStore = new NoOpEventStore();
  const applicationService = new ApplicationService(
    unitOfWork,
    eventManager,
    eventPublisher,
    eventStore,
  );
  const createUserUseCase = new CreateUserUseCase(userRepository);
  const controller = new CreateUserController(applicationService, createUserUseCase);

  return { controller, userRepository };
}

describe("CreateUserController", () => {
  beforeEach(() => {
    AggregateRoot.setOnTrack((aggregate) => {
      AggregateTracker.track(aggregate);
    });
  });

  afterEach(() => {
    AggregateRoot.setOnTrack(null);
  });

  it("should return 201 with created user data", async () => {
    const { controller } = createTestDependencies();

    const result = await controller.handle({
      name: "John Doe",
      email: "john@example.com",
    });

    assert.equal(result.statusCode, 201);
    const body = result.body as { id: string; name: string; email: string };
    assert.ok(body.id.length > 0);
    assert.equal(body.name, "John Doe");
    assert.equal(body.email, "john@example.com");
  });

  it("should return 409 when email already exists", async () => {
    const { controller } = createTestDependencies();

    await controller.handle({
      name: "John Doe",
      email: "john@example.com",
    });

    const result = await controller.handle({
      name: "Jane Doe",
      email: "john@example.com",
    });

    assert.equal(result.statusCode, 409);
    const body = result.body as { error: string };
    assert.equal(body.error, "User with email john@example.com already exists");
  });

  it("should return 400 when email format is invalid", async () => {
    const { controller } = createTestDependencies();

    const result = await controller.handle({
      name: "John Doe",
      email: "invalid-email",
    });

    assert.equal(result.statusCode, 400);
    const body = result.body as { error: string };
    assert.ok(body.error.includes("Invalid email"));
  });

  it("should return 400 when name is missing", async () => {
    const { controller } = createTestDependencies();

    const result = await controller.handle({
      email: "john@example.com",
    });

    assert.equal(result.statusCode, 400);
    const body = result.body as { error: string };
    assert.equal(body.error, "Name is required");
  });

  it("should return 400 when email is missing", async () => {
    const { controller } = createTestDependencies();

    const result = await controller.handle({
      name: "John Doe",
    });

    assert.equal(result.statusCode, 400);
    const body = result.body as { error: string };
    assert.equal(body.error, "Email is required");
  });
});
