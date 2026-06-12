import { EntitySchema } from "@mikro-orm/core";
import { UserEntity, AddressEntity } from "../entities/UserEntity.ts";

export const UserEntitySchema = new EntitySchema<UserEntity>({
  class: UserEntity,
  tableName: "users",
  properties: {
    id: { type: "string", primary: true },
    name: { type: "string" },
    email: { type: "string", unique: true },
    addresses: {
      kind: "1:m",
      entity: () => AddressEntity,
      mappedBy: "user",
      orphanRemoval: true,
    },
  },
});

export const AddressEntitySchema = new EntitySchema<AddressEntity>({
  class: AddressEntity,
  tableName: "addresses",
  properties: {
    id: { type: "string", primary: true },
    street: { type: "string" },
    number: { type: "string" },
    city: { type: "string" },
    state: { type: "string" },
    zipCode: { type: "string", fieldName: "zip_code" },
    user: {
      kind: "m:1",
      entity: () => UserEntity,
      inversedBy: "addresses",
    },
  },
});
