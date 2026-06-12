import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GetUserByIdUseCase } from "./GetUserByIdUseCase.ts";
import { GetUserByIdQuery } from "../command/GetUserByIdQuery.ts";
import { InMemoryUserRepository } from "../../infrastructure/persistence/in-memory/InMemoryUserRepository.ts";
import { User } from "../../domain/aggregates/User.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";
import { AddressId } from "../../domain/identifiers/AddressId.ts";
import { Street } from "../../domain/valueObjects/Street.ts";
import { AddressNumber } from "../../domain/valueObjects/AddressNumber.ts";
import { City } from "../../domain/valueObjects/City.ts";
import { State } from "../../domain/valueObjects/State.ts";
import { ZipCode } from "../../domain/valueObjects/ZipCode.ts";

describe("GetUserByIdUseCase", () => {
  it("should return a user by id", async () => {
    const userRepository = new InMemoryUserRepository();
    const existingUser = User.create(
      new UserId("user-1"),
      "John Doe",
      new Email("john@example.com"),
    );
    await userRepository.save(existingUser);

    const useCase = new GetUserByIdUseCase(userRepository);
    const query = GetUserByIdQuery.of("user-1");

    const result = await useCase.execute(query);

    assert.equal(result.id.value, "user-1");
    assert.equal(result.name, "John Doe");
    assert.equal(result.email.value, "john@example.com");
  });

  it("should return a user with addresses", async () => {
    const userRepository = new InMemoryUserRepository();
    const existingUser = User.create(
      new UserId("user-1"),
      "John Doe",
      new Email("john@example.com"),
    );
    existingUser.addAddress(
      new AddressId("addr-1"),
      new Street("Rua A"),
      new AddressNumber("123"),
      new City("Sao Paulo"),
      new State("SP"),
      new ZipCode("01000-000"),
    );
    await userRepository.save(existingUser);

    const useCase = new GetUserByIdUseCase(userRepository);
    const query = GetUserByIdQuery.of("user-1");

    const result = await useCase.execute(query);

    assert.equal(result.addresses.length, 1);
    assert.equal(result.addresses[0]!.id.value, "addr-1");
    assert.equal(result.addresses[0]!.street.value, "Rua A");
  });

  it("should throw when user is not found", async () => {
    const userRepository = new InMemoryUserRepository();
    const useCase = new GetUserByIdUseCase(userRepository);
    const query = GetUserByIdQuery.of("non-existent");

    await assert.rejects(() => useCase.execute(query), { message: "User not found: non-existent" });
  });
});
