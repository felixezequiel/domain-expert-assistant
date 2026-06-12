import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AddAddressUseCase } from "./AddAddressUseCase.ts";
import { AddAddressCommand } from "../command/AddAddressCommand.ts";
import { InMemoryUserRepository } from "../../infrastructure/persistence/in-memory/InMemoryUserRepository.ts";
import { User } from "../../domain/aggregates/User.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";

describe("AddAddressUseCase", () => {
  it("should add an address to an existing user and return the user", async () => {
    const userRepository = new InMemoryUserRepository();
    const existingUser = User.create(
      new UserId("user-1"),
      "John Doe",
      new Email("john@example.com"),
    );
    await userRepository.save(existingUser);

    const useCase = new AddAddressUseCase(userRepository);
    const command = AddAddressCommand.of(
      "user-1",
      "addr-1",
      "Rua A",
      "123",
      "Sao Paulo",
      "SP",
      "01000-000",
    );

    const result = await useCase.execute(command);

    assert.equal(result.addresses.length, 1);
    assert.equal(result.addresses[0]!.id.value, "addr-1");
    assert.equal(result.addresses[0]!.street.value, "Rua A");
    assert.equal(result.addresses[0]!.city.value, "Sao Paulo");
  });

  it("should throw when user is not found", async () => {
    const userRepository = new InMemoryUserRepository();
    const useCase = new AddAddressUseCase(userRepository);
    const command = AddAddressCommand.of(
      "non-existent",
      "addr-1",
      "Rua A",
      "123",
      "Sao Paulo",
      "SP",
      "01000-000",
    );

    await assert.rejects(() => useCase.execute(command), {
      message: "User not found: non-existent",
    });
  });

  it("should emit an AddressAdded domain event", async () => {
    const userRepository = new InMemoryUserRepository();
    const existingUser = User.create(
      new UserId("user-1"),
      "John Doe",
      new Email("john@example.com"),
    );
    existingUser.getDomainEvents();
    await userRepository.save(existingUser);

    const useCase = new AddAddressUseCase(userRepository);
    const command = AddAddressCommand.of(
      "user-1",
      "addr-1",
      "Rua A",
      "123",
      "Sao Paulo",
      "SP",
      "01000-000",
    );

    const result = await useCase.execute(command);
    const events = result.getDomainEvents();
    const addressAddedEvents = events.filter((event) => event.eventName === "AddressAdded");

    assert.equal(addressAddedEvents.length, 1);
    assert.equal(addressAddedEvents[0]!.aggregateId, "user-1");
  });
});
