import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { AddAddressController } from "./AddAddressController.ts";
import { ApplicationService } from "../../../../shared/application/ApplicationService.ts";
import { DomainEventManager } from "../../../../shared/application/DomainEventManager.ts";
import type { EventPublisherPort } from "../../../../shared/ports/EventPublisherPort.ts";
import { CreateUserUseCase } from "../../application/usecase/CreateUserUseCase.ts";
import { AddAddressUseCase } from "../../application/usecase/AddAddressUseCase.ts";
import { CreateUserCommand } from "../../application/command/CreateUserCommand.ts";
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
  const addAddressUseCase = new AddAddressUseCase(userRepository);
  const createUserUseCase = new CreateUserUseCase(userRepository);
  const controller = new AddAddressController(applicationService, addAddressUseCase);

  return { controller, applicationService, createUserUseCase, userRepository };
}

describe("AddAddressController", () => {
  beforeEach(() => {
    AggregateRoot.setOnTrack((aggregate) => {
      AggregateTracker.track(aggregate);
    });
  });

  afterEach(() => {
    AggregateRoot.setOnTrack(null);
  });

  it("should return 201 with the added address data", async () => {
    const { controller, applicationService, createUserUseCase } = createTestDependencies();

    const createCommand = CreateUserCommand.of("user-1", "John Doe", "john@example.com");
    await applicationService.execute(createUserUseCase, createCommand);

    const result = await controller.handle(
      { street: "Rua A", number: "123", city: "Sao Paulo", state: "SP", zipCode: "01000-000" },
      { userId: "user-1" },
    );

    assert.equal(result.statusCode, 201);
    const body = result.body as { userId: string; addressId: string; street: string };
    assert.equal(body.userId, "user-1");
    assert.ok(body.addressId.length > 0);
    assert.equal(body.street, "Rua A");
  });

  it("should return 404 when user does not exist", async () => {
    const { controller } = createTestDependencies();

    const result = await controller.handle(
      { street: "Rua A", number: "123", city: "Sao Paulo", state: "SP", zipCode: "01000-000" },
      { userId: "non-existent" },
    );

    assert.equal(result.statusCode, 404);
    const body = result.body as { error: string };
    assert.ok(body.error.includes("User not found"));
  });

  it("should return 400 when street is missing", async () => {
    const { controller } = createTestDependencies();

    const result = await controller.handle(
      { number: "123", city: "Sao Paulo", state: "SP", zipCode: "01000-000" },
      { userId: "user-1" },
    );

    assert.equal(result.statusCode, 400);
    const body = result.body as { error: string };
    assert.equal(body.error, "Street is required");
  });
});
