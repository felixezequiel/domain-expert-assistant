import { User } from "../../../../domain/aggregates/User.ts";
import { Address } from "../../../../domain/entities/Address.ts";
import { UserId } from "../../../../domain/identifiers/UserId.ts";
import { AddressId } from "../../../../domain/identifiers/AddressId.ts";
import { Email } from "../../../../domain/valueObjects/Email.ts";
import { Street } from "../../../../domain/valueObjects/Street.ts";
import { AddressNumber } from "../../../../domain/valueObjects/AddressNumber.ts";
import { City } from "../../../../domain/valueObjects/City.ts";
import { State } from "../../../../domain/valueObjects/State.ts";
import { ZipCode } from "../../../../domain/valueObjects/ZipCode.ts";
import { UserEntity, AddressEntity } from "../entities/UserEntity.ts";

export class UserMapper {
  public static toDomain(entity: UserEntity): User {
    const addresses: Array<Address> = [];
    for (const addressEntity of entity.addresses) {
      const address = Address.reconstitute(
        new AddressId(addressEntity.id),
        new Street(addressEntity.street),
        new AddressNumber(addressEntity.number),
        new City(addressEntity.city),
        new State(addressEntity.state),
        new ZipCode(addressEntity.zipCode),
      );
      addresses.push(address);
    }

    return User.reconstitute(
      new UserId(entity.id),
      entity.name,
      new Email(entity.email),
      addresses,
    );
  }

  public static toOrmEntity(user: User): UserEntity {
    const entity = new UserEntity();
    entity.id = user.id.value;
    entity.name = user.name;
    entity.email = user.email.value;

    const addressEntities: Array<AddressEntity> = [];
    for (const address of user.addresses) {
      const addressEntity = new AddressEntity();
      addressEntity.id = address.id.value;
      addressEntity.street = address.street.value;
      addressEntity.number = address.number.value;
      addressEntity.city = address.city.value;
      addressEntity.state = address.state.value;
      addressEntity.zipCode = address.zipCode.value;
      addressEntity.user = entity;
      addressEntities.push(addressEntity);
    }
    entity.addresses = addressEntities;

    return entity;
  }
}
