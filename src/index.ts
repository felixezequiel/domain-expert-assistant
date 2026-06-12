export { Identifier } from "./shared/domain/identifiers/Identifier.ts";
export { ValueObject } from "./shared/domain/valueObjects/ValueObject.ts";
export { Entity } from "./shared/domain/entities/Entity.ts";
export { AggregateRoot } from "./shared/domain/aggregates/AggregateRoot.ts";
export type { DomainEvent } from "./shared/domain/events/DomainEvent.ts";

export { ApplicationService } from "./shared/application/ApplicationService.ts";
export { DomainEventManager } from "./shared/application/DomainEventManager.ts";
export type { UseCase } from "./shared/application/UseCase.ts";
export type { UnitOfWork } from "./shared/application/UnitOfWork.ts";

export type { RepositoryPort } from "./shared/ports/RepositoryPort.ts";
export type { LoggerPort } from "./shared/ports/LoggerPort.ts";
export type { EventPublisherPort } from "./shared/ports/EventPublisherPort.ts";

export { ConsoleLogger } from "./shared/infrastructure/logging/ConsoleLogger.ts";
export { LoggerRegistry } from "./shared/infrastructure/logging/LoggerRegistry.ts";
export { log } from "./shared/infrastructure/decorators/Log.ts";
