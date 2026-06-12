import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserMapper } from "./UserMapper.ts";
import { User } from "../../../../domain/aggregates/User.ts";
import { UserId } from "../../../../domain/identifiers/UserId.ts";
import { Email } from "../../../../domain/valueObjects/Email.ts";
import { AddressId } from "../../../../domain/identifiers/AddressId.ts";
import { Street } from "../../../../domain/valueObjects/Street.ts";
import { AddressNumber } from "../../../../domain/valueObjects/AddressNumber.ts";
import { City } from "../../../../domain/valueObjects/City.ts";
import { State } from "../../../../domain/valueObjects/State.ts";
import { ZipCode } from "../../../../domain/valueObjects/ZipCode.ts";
import { UserEntity, AddressEntity } from "../entities/UserEntity.ts";

describe("UserMapper", () => {
  it("should map a domain User to an ORM UserEntity", () => {
    const user = User.create(new UserId("user-1"), "John Doe", new Email("john@example.com"));
    user.addAddress(
      new AddressId("addr-1"),
      new Street("Rua A"),
      new AddressNumber("123"),
      new City("Sao Paulo"),
      new State("SP"),
      new ZipCode("01000-000"),
    );

    const entity = UserMapper.toOrmEntity(user);

    assert.equal(entity.id, "user-1");
    assert.equal(entity.name, "John Doe");
    assert.equal(entity.email, "john@example.com");
    assert.equal(entity.addresses.length, 1);
    assert.equal(entity.addresses[0]!.id, "addr-1");
    assert.equal(entity.addresses[0]!.street, "Rua A");
    assert.equal(entity.addresses[0]!.number, "123");
    assert.equal(entity.addresses[0]!.city, "Sao Paulo");
    assert.equal(entity.addresses[0]!.state, "SP");
    assert.equal(entity.addresses[0]!.zipCode, "01000-000");
  });

  it("should map an ORM UserEntity to a domain User via reconstitute", () => {
    const entity = new UserEntity();
    entity.id = "user-1";
    entity.name = "John Doe";
    entity.email = "john@example.com";

    const addressEntity = new AddressEntity();
    addressEntity.id = "addr-1";
    addressEntity.street = "Rua A";
    addressEntity.number = "123";
    addressEntity.city = "Sao Paulo";
    addressEntity.state = "SP";
    addressEntity.zipCode = "01000-000";
    entity.addresses = [addressEntity];

    const user = UserMapper.toDomain(entity);

    assert.equal(user.id.value, "user-1");
    assert.equal(user.name, "John Doe");
    assert.equal(user.email.value, "john@example.com");
    assert.equal(user.addresses.length, 1);
    assert.equal(user.addresses[0]!.id.value, "addr-1");
    assert.equal(user.addresses[0]!.street.value, "Rua A");
    assert.equal(user.getDomainEvents().length, 0);
  });

  it("should map a user with no addresses", () => {
    const entity = new UserEntity();
    entity.id = "user-1";
    entity.name = "John Doe";
    entity.email = "john@example.com";
    entity.addresses = [];

    const user = UserMapper.toDomain(entity);

    assert.equal(user.addresses.length, 0);
    assert.equal(user.getDomainEvents().length, 0);
  });
});
