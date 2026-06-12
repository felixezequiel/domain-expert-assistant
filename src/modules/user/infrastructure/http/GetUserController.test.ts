import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GetUserController } from "./GetUserController.ts";
import { ApplicationService } from "../../../../shared/application/ApplicationService.ts";
import { DomainEventManager } from "../../../../shared/application/DomainEventManager.ts";
import type { EventPublisherPort } from "../../../../shared/ports/EventPublisherPort.ts";
import { CreateUserUseCase } from "../../application/usecase/CreateUserUseCase.ts";
import { GetUserByIdUseCase } from "../../application/usecase/GetUserByIdUseCase.ts";
import { AddAddressUseCase } from "../../application/usecase/AddAddressUseCase.ts";
import { CreateUserCommand } from "../../application/command/CreateUserCommand.ts";
import { AddAddressCommand } from "../../application/command/AddAddressCommand.ts";
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
  const getUserByIdUseCase = new GetUserByIdUseCase(userRepository);
  const createUserUseCase = new CreateUserUseCase(userRepository);
  const addAddressUseCase = new AddAddressUseCase(userRepository);
  const controller = new GetUserController(applicationService, getUserByIdUseCase);

  return { controller, applicationService, createUserUseCase, addAddressUseCase };
}

describe("GetUserController", () => {
  beforeEach(() => {
    AggregateRoot.setOnTrack((aggregate) => {
      AggregateTracker.track(aggregate);
    });
  });

  afterEach(() => {
    AggregateRoot.setOnTrack(null);
  });

  it("should return 200 with user data", async () => {
    const { controller, applicationService, createUserUseCase } = createTestDependencies();

    const createCommand = CreateUserCommand.of("user-1", "John Doe", "john@example.com");
    await applicationService.execute(createUserUseCase, createCommand);

    const result = await controller.handle({}, { userId: "user-1" });

    assert.equal(result.statusCode, 200);
    const body = result.body as {
      id: string;
      name: string;
      email: string;
      addresses: Array<unknown>;
    };
    assert.equal(body.id, "user-1");
    assert.equal(body.name, "John Doe");
    assert.equal(body.email, "john@example.com");
    assert.equal(body.addresses.length, 0);
  });

  it("should return user with addresses", async () => {
    const { controller, applicationService, createUserUseCase, addAddressUseCase } =
      createTestDependencies();

    const createCommand = CreateUserCommand.of("user-1", "John Doe", "john@example.com");
    await applicationService.execute(createUserUseCase, createCommand);

    const addCommand = AddAddressCommand.of(
      "user-1",
      "addr-1",
      "Rua A",
      "123",
      "Sao Paulo",
      "SP",
      "01000-000",
    );
    await applicationService.execute(addAddressUseCase, addCommand);

    const result = await controller.handle({}, { userId: "user-1" });

    assert.equal(result.statusCode, 200);
    const body = result.body as { addresses: Array<{ id: string; street: string }> };
    assert.equal(body.addresses.length, 1);
    assert.equal(body.addresses[0]!.id, "addr-1");
    assert.equal(body.addresses[0]!.street, "Rua A");
  });

  it("should return 404 when user does not exist", async () => {
    const { controller } = createTestDependencies();

    const result = await controller.handle({}, { userId: "non-existent" });

    assert.equal(result.statusCode, 404);
    const body = result.body as { error: string };
    assert.ok(body.error.includes("User not found"));
  });
});
