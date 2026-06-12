import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { User } from "./User.ts";
import { UserId } from "../identifiers/UserId.ts";
import { Email } from "../valueObjects/Email.ts";
import { AddressId } from "../identifiers/AddressId.ts";
import { Address } from "../entities/Address.ts";
import { Street } from "../valueObjects/Street.ts";
import { AddressNumber } from "../valueObjects/AddressNumber.ts";
import { City } from "../valueObjects/City.ts";
import { State } from "../valueObjects/State.ts";
import { ZipCode } from "../valueObjects/ZipCode.ts";

describe("User", () => {
  it("should create a user with id, name, and email", () => {
    const userId = new UserId("user-1");
    const email = new Email("john@example.com");

    const user = User.create(userId, "John Doe", email);

    assert.equal(user.id.value, "user-1");
    assert.equal(user.name, "John Doe");
    assert.ok(user.email.equals(email));
  });

  it("should emit UserCreatedEvent when created", () => {
    const userId = new UserId("user-1");
    const email = new Email("john@example.com");

    const user = User.create(userId, "John Doe", email);
    const events = user.getDomainEvents();

    assert.equal(events.length, 1);
    assert.equal(events[0]!.eventName, "UserCreated");
    assert.equal(events[0]!.aggregateId, "user-1");
  });

  it("should be equal to another user with the same id", () => {
    const firstUser = User.create(new UserId("user-1"), "John", new Email("john@example.com"));
    const secondUser = User.create(new UserId("user-1"), "Jane", new Email("jane@example.com"));

    assert.ok(firstUser.equals(secondUser));
  });

  it("should not be equal to a user with a different id", () => {
    const firstUser = User.create(new UserId("user-1"), "John", new Email("john@example.com"));
    const secondUser = User.create(new UserId("user-2"), "John", new Email("john@example.com"));

    assert.ok(!firstUser.equals(secondUser));
  });

  it("should start with an empty list of addresses", () => {
    const user = User.create(new UserId("user-1"), "John", new Email("john@example.com"));

    assert.equal(user.addresses.length, 0);
  });

  it("should add an address and emit AddressAddedEvent", () => {
    const user = User.create(new UserId("user-1"), "John", new Email("john@example.com"));
    const addressId = new AddressId("addr-1");

    user.addAddress(
      addressId,
      new Street("Rua das Flores"),
      new AddressNumber("123"),
      new City("Sao Paulo"),
      new State("SP"),
      new ZipCode("01000-000"),
    );

    assert.equal(user.addresses.length, 1);
    assert.equal(user.addresses[0]!.id.value, "addr-1");
    assert.equal(user.addresses[0]!.street.value, "Rua das Flores");

    const events = user.getDomainEvents();
    const addressAddedEvent = events[events.length - 1]!;
    assert.equal(addressAddedEvent.eventName, "AddressAdded");
  });

  it("should remove an address by id and emit AddressRemovedEvent", () => {
    const user = User.create(new UserId("user-1"), "John", new Email("john@example.com"));
    const addressId = new AddressId("addr-1");
    user.addAddress(
      addressId,
      new Street("Rua das Flores"),
      new AddressNumber("123"),
      new City("Sao Paulo"),
      new State("SP"),
      new ZipCode("01000-000"),
    );

    user.removeAddress(addressId);

    assert.equal(user.addresses.length, 0);

    const events = user.getDomainEvents();
    const addressRemovedEvent = events[events.length - 1]!;
    assert.equal(addressRemovedEvent.eventName, "AddressRemoved");
  });

  it("should throw when removing an address that does not exist", () => {
    const user = User.create(new UserId("user-1"), "John", new Email("john@example.com"));
    const nonExistentId = new AddressId("addr-999");

    assert.throws(() => user.removeAddress(nonExistentId), {
      message: "Address not found: addr-999",
    });
  });

  it("should manage multiple addresses independently", () => {
    const user = User.create(new UserId("user-1"), "John", new Email("john@example.com"));
    const firstAddressId = new AddressId("addr-1");
    const secondAddressId = new AddressId("addr-2");

    user.addAddress(
      firstAddressId,
      new Street("Rua A"),
      new AddressNumber("1"),
      new City("Sao Paulo"),
      new State("SP"),
      new ZipCode("01000-000"),
    );
    user.addAddress(
      secondAddressId,
      new Street("Rua B"),
      new AddressNumber("2"),
      new City("Rio de Janeiro"),
      new State("RJ"),
      new ZipCode("20000-000"),
    );

    assert.equal(user.addresses.length, 2);

    user.removeAddress(firstAddressId);

    assert.equal(user.addresses.length, 1);
    assert.equal(user.addresses[0]!.id.value, "addr-2");
  });

  it("should reconstitute a user without emitting domain events", () => {
    const userId = new UserId("user-1");
    const email = new Email("john@example.com");
    const addresses = [
      Address.create(
        new AddressId("addr-1"),
        new Street("Rua A"),
        new AddressNumber("1"),
        new City("Sao Paulo"),
        new State("SP"),
        new ZipCode("01000-000"),
      ),
    ];

    const user = User.reconstitute(userId, "John Doe", email, addresses);

    assert.equal(user.id.value, "user-1");
    assert.equal(user.name, "John Doe");
    assert.ok(user.email.equals(email));
    assert.equal(user.addresses.length, 1);
    assert.equal(user.addresses[0]!.id.value, "addr-1");
    assert.equal(user.getDomainEvents().length, 0);
  });

  it("should reconstitute a user with an empty address list", () => {
    const userId = new UserId("user-1");
    const email = new Email("john@example.com");

    const user = User.reconstitute(userId, "John Doe", email, []);

    assert.equal(user.addresses.length, 0);
    assert.equal(user.getDomainEvents().length, 0);
  });
});
