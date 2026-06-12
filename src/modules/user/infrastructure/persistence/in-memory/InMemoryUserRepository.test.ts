import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InMemoryUserRepository } from "./InMemoryUserRepository.ts";
import { User } from "../../../domain/aggregates/User.ts";
import { UserId } from "../../../domain/identifiers/UserId.ts";
import { Email } from "../../../domain/valueObjects/Email.ts";

describe("InMemoryUserRepository", () => {
  it("should save and find a user by id", async () => {
    const repository = new InMemoryUserRepository();
    const user = User.create(new UserId("user-1"), "John", new Email("john@test.com"));

    await repository.save(user);
    const found = await repository.findById(new UserId("user-1"));

    assert.ok(found !== null);
    assert.equal(found!.id.value, "user-1");
  });

  it("should return null when user is not found by id", async () => {
    const repository = new InMemoryUserRepository();

    const found = await repository.findById(new UserId("non-existent"));

    assert.equal(found, null);
  });

  it("should find a user by email", async () => {
    const repository = new InMemoryUserRepository();
    const user = User.create(new UserId("user-1"), "John", new Email("john@test.com"));

    await repository.save(user);
    const found = await repository.findByEmail("john@test.com");

    assert.ok(found !== null);
    assert.equal(found!.name, "John");
  });

  it("should return null when user is not found by email", async () => {
    const repository = new InMemoryUserRepository();

    const found = await repository.findByEmail("unknown@test.com");

    assert.equal(found, null);
  });

  it("should delete a user by id", async () => {
    const repository = new InMemoryUserRepository();
    const userId = new UserId("user-1");
    const user = User.create(userId, "John", new Email("john@test.com"));

    await repository.save(user);
    await repository.delete(userId);
    const found = await repository.findById(userId);

    assert.equal(found, null);
  });

  it("should update a user when saving with the same id", async () => {
    const repository = new InMemoryUserRepository();
    const userId = new UserId("user-1");

    const firstUser = User.create(userId, "John", new Email("john@test.com"));
    await repository.save(firstUser);

    const updatedUser = User.create(userId, "John Updated", new Email("updated@test.com"));
    await repository.save(updatedUser);

    const found = await repository.findById(userId);
    assert.ok(found !== null);
    assert.equal(found!.name, "John Updated");
  });
});
