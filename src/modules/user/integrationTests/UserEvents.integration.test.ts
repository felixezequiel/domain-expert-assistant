import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import { DomainEventManager } from "../../../shared/application/DomainEventManager.ts";
import { EventEmitterEventBus } from "../../../shared/infrastructure/events/EventEmitterEventBus.ts";
import { AggregateRoot } from "../../../shared/domain/aggregates/AggregateRoot.ts";
import { AggregateTracker } from "../../../shared/infrastructure/persistence/AggregateTracker.ts";
import { EventEmittingAdapter } from "../../../shared/infrastructure/adapters/EventEmittingAdapter.ts";
import { InMemoryUnitOfWork } from "../../../shared/infrastructure/persistence/adapters/InMemoryUnitOfWork.ts";
import { CreateUserUseCase } from "../application/usecase/CreateUserUseCase.ts";
import { SendWelcomeEmailUseCase } from "../application/usecase/SendWelcomeEmailUseCase.ts";
import { CreateUserCommand } from "../application/command/CreateUserCommand.ts";
import { SendWelcomeEmailCommand } from "../application/command/SendWelcomeEmailCommand.ts";
import { InMemoryUserRepository } from "../infrastructure/persistence/in-memory/InMemoryUserRepository.ts";
import { ConsoleEmailNotification } from "../infrastructure/notifications/ConsoleEmailNotification.ts";
import { NoOpEventStore } from "../../../shared/infrastructure/persistence/adapters/eventStore/NoOpEventStore.ts";
import { User } from "../domain/aggregates/User.ts";
import type { EmailNotificationPort } from "../application/port/secondary/EmailNotificationPort.ts";
import type { UserCreatedEvent } from "../domain/events/UserCreatedEvent.ts";
import type { DomainEvent } from "../../../shared/domain/events/DomainEvent.ts";
import type { LoggerPort } from "../../../shared/ports/LoggerPort.ts";

class FakeEmailNotification implements EmailNotificationPort {
  public sentEmails: Array<{ email: string; userId: string; causationId: string | null }> = [];

  public async sendWelcomeEmail(
    email: string,
    userId: string,
    causationId: string | null,
  ): Promise<void> {
    this.sentEmails.push({ email, userId, causationId });
  }
}

class SpyLogger implements LoggerPort {
  public info(): void {}
  public warn(): void {}
  public error(): void {}
  public debug(): void {}
}

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

describe("User domain events integration", () => {
  beforeEach(() => {
    AggregateRoot.setOnTrack((aggregate) => {
      AggregateTracker.track(aggregate);
    });
    EventEmittingAdapter.setOnTrack((source) => {
      AggregateTracker.track(source);
    });
  });

  afterEach(() => {
    AggregateRoot.setOnTrack(null);
    EventEmittingAdapter.setOnTrack(null);
  });

  it("should send a welcome email when a user is created", async () => {
    const userRepository = new InMemoryUserRepository();
    const unitOfWork = new InMemoryUnitOfWork([createUserRepositoryAdapter(userRepository)]);
    const domainEventManager = new DomainEventManager();
    const eventBus = new EventEmitterEventBus();

    const eventStore = new NoOpEventStore();
    const applicationService = new ApplicationService(
      unitOfWork,
      domainEventManager,
      eventBus,
      eventStore,
    );

    const createUserUseCase = new CreateUserUseCase(userRepository);

    const fakeEmailNotification = new FakeEmailNotification();
    const sendWelcomeEmailUseCase = new SendWelcomeEmailUseCase(fakeEmailNotification);

    eventBus.subscribe("UserCreated", async (event) => {
      const userCreatedEvent = event as UserCreatedEvent;
      const command = SendWelcomeEmailCommand.of(
        userCreatedEvent.aggregateId,
        userCreatedEvent.email,
      );
      await applicationService.execute(sendWelcomeEmailUseCase, command);
    });

    const createCommand = CreateUserCommand.of("user-1", "John Doe", "john@example.com");
    await applicationService.execute(createUserUseCase, createCommand);

    assert.equal(fakeEmailNotification.sentEmails.length, 1);
    assert.equal(fakeEmailNotification.sentEmails[0]!.email, "john@example.com");
    assert.equal(fakeEmailNotification.sentEmails[0]!.userId, "user-1");
  });

  it("should not send a welcome email when user creation fails", async () => {
    const userRepository = new InMemoryUserRepository();
    const unitOfWork = new InMemoryUnitOfWork([createUserRepositoryAdapter(userRepository)]);
    const domainEventManager = new DomainEventManager();
    const eventBus = new EventEmitterEventBus();

    const eventStore = new NoOpEventStore();
    const applicationService = new ApplicationService(
      unitOfWork,
      domainEventManager,
      eventBus,
      eventStore,
    );

    const createUserUseCase = new CreateUserUseCase(userRepository);

    const fakeEmailNotification = new FakeEmailNotification();
    const sendWelcomeEmailUseCase = new SendWelcomeEmailUseCase(fakeEmailNotification);

    eventBus.subscribe("UserCreated", async (event) => {
      const userCreatedEvent = event as UserCreatedEvent;
      const command = SendWelcomeEmailCommand.of(
        userCreatedEvent.aggregateId,
        userCreatedEvent.email,
      );
      await applicationService.execute(sendWelcomeEmailUseCase, command);
    });

    const firstCommand = CreateUserCommand.of("user-1", "John", "john@example.com");
    await applicationService.execute(createUserUseCase, firstCommand);

    const duplicateCommand = CreateUserCommand.of("user-2", "Jane", "john@example.com");
    await assert.rejects(() => applicationService.execute(createUserUseCase, duplicateCommand), {
      message: "User with email john@example.com already exists",
    });

    assert.equal(fakeEmailNotification.sentEmails.length, 1);
  });

  it("should dispatch WelcomeEmailSent event when adapter emits it via per-request adapter", async () => {
    const userRepository = new InMemoryUserRepository();
    const unitOfWork = new InMemoryUnitOfWork([createUserRepositoryAdapter(userRepository)]);
    const domainEventManager = new DomainEventManager();
    const eventBus = new EventEmitterEventBus();

    const eventStore = new NoOpEventStore();
    const applicationService = new ApplicationService(
      unitOfWork,
      domainEventManager,
      eventBus,
      eventStore,
    );

    const createUserUseCase = new CreateUserUseCase(userRepository);
    const spyLogger = new SpyLogger();

    const publishedEvents: Array<DomainEvent> = [];
    const originalPublishAll = eventBus.publishAll.bind(eventBus);
    eventBus.publishAll = async (events: ReadonlyArray<DomainEvent>) => {
      for (const event of events) {
        publishedEvents.push(event);
      }
      await originalPublishAll(events);
    };

    eventBus.subscribe("UserCreated", async (event) => {
      const userCreatedEvent = event as UserCreatedEvent;
      const emailNotification = new ConsoleEmailNotification(spyLogger);
      const sendWelcomeEmailUseCase = new SendWelcomeEmailUseCase(emailNotification);
      const command = SendWelcomeEmailCommand.of(
        userCreatedEvent.aggregateId,
        userCreatedEvent.email,
      );
      await applicationService.execute(sendWelcomeEmailUseCase, command);
    });

    const createCommand = CreateUserCommand.of("user-1", "John Doe", "john@example.com");
    await applicationService.execute(createUserUseCase, createCommand);

    const eventNames: Array<string> = [];
    for (const event of publishedEvents) {
      eventNames.push(event.eventName);
    }

    assert.ok(eventNames.includes("UserCreated"));
    assert.ok(eventNames.includes("WelcomeEmailSent"));
  });

  it("should set causationId on WelcomeEmailSent linking it to the UserCreated event", async () => {
    const userRepository = new InMemoryUserRepository();
    const unitOfWork = new InMemoryUnitOfWork([createUserRepositoryAdapter(userRepository)]);
    const domainEventManager = new DomainEventManager();
    const eventBus = new EventEmitterEventBus();

    const eventStore = new NoOpEventStore();
    const applicationService = new ApplicationService(
      unitOfWork,
      domainEventManager,
      eventBus,
      eventStore,
    );

    const createUserUseCase = new CreateUserUseCase(userRepository);
    const spyLogger = new SpyLogger();

    const publishedEvents: Array<DomainEvent> = [];
    const originalPublishAll = eventBus.publishAll.bind(eventBus);
    eventBus.publishAll = async (events: ReadonlyArray<DomainEvent>) => {
      for (const event of events) {
        publishedEvents.push(event);
      }
      await originalPublishAll(events);
    };

    eventBus.subscribe("UserCreated", async (event) => {
      const userCreatedEvent = event as UserCreatedEvent;
      const emailNotification = new ConsoleEmailNotification(spyLogger);
      const sendWelcomeEmailUseCase = new SendWelcomeEmailUseCase(emailNotification);
      const command = SendWelcomeEmailCommand.of(
        userCreatedEvent.aggregateId,
        userCreatedEvent.email,
        userCreatedEvent.eventId,
      );
      await applicationService.execute(sendWelcomeEmailUseCase, command);
    });

    const createCommand = CreateUserCommand.of("user-1", "John Doe", "john@example.com");
    await applicationService.execute(createUserUseCase, createCommand);

    let userCreatedEvent: DomainEvent | undefined;
    let welcomeEmailSentEvent: DomainEvent | undefined;
    for (const event of publishedEvents) {
      if (event.eventName === "UserCreated") {
        userCreatedEvent = event;
      }
      if (event.eventName === "WelcomeEmailSent") {
        welcomeEmailSentEvent = event;
      }
    }

    assert.ok(userCreatedEvent !== undefined);
    assert.ok(welcomeEmailSentEvent !== undefined);
    assert.equal(userCreatedEvent.causationId, null);
    assert.equal(welcomeEmailSentEvent.causationId, userCreatedEvent.eventId);
  });
});
