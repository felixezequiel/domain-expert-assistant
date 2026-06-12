import { AggregateRoot } from "../../../../shared/domain/aggregates/AggregateRoot.ts";
import { Address } from "../entities/Address.ts";
import { AddressAddedEvent } from "../events/AddressAddedEvent.ts";
import { AddressRemovedEvent } from "../events/AddressRemovedEvent.ts";
import { UserCreatedEvent } from "../events/UserCreatedEvent.ts";
import type { AddressId } from "../identifiers/AddressId.ts";
import type { Email } from "../valueObjects/Email.ts";
import type { Street } from "../valueObjects/Street.ts";
import type { AddressNumber } from "../valueObjects/AddressNumber.ts";
import type { City } from "../valueObjects/City.ts";
import type { State } from "../valueObjects/State.ts";
import type { ZipCode } from "../valueObjects/ZipCode.ts";
import type { UserId } from "../identifiers/UserId.ts";

interface UserProps {
  readonly name: string;
  readonly email: Email;
}

export class User extends AggregateRoot<UserId, UserProps> {
  private readonly _addresses: Array<Address> = [];

  public get name(): string {
    return this.props.name;
  }

  public get email(): Email {
    return this.props.email;
  }

  public get addresses(): ReadonlyArray<Address> {
    return [...this._addresses];
  }

  public static create(id: UserId, name: string, email: Email): User {
    const user = new User(id, { name, email });
    user.addDomainEvent(new UserCreatedEvent(id.value, email.value));
    return user;
  }

  public static reconstitute(
    id: UserId,
    name: string,
    email: Email,
    addresses: ReadonlyArray<Address>,
  ): User {
    const user = new User(id, { name, email });
    for (const address of addresses) {
      user._addresses.push(address);
    }
    return user;
  }

  public addAddress(
    addressId: AddressId,
    street: Street,
    number: AddressNumber,
    city: City,
    state: State,
    zipCode: ZipCode,
  ): void {
    const address = Address.create(addressId, street, number, city, state, zipCode);
    this._addresses.push(address);
    this.addDomainEvent(new AddressAddedEvent(this.id.value, addressId.value));
  }

  public removeAddress(addressId: AddressId): void {
    const addressIndex = this._addresses.findIndex((address) => address.id.equals(addressId));

    const ADDRESS_NOT_FOUND = -1;
    if (addressIndex === ADDRESS_NOT_FOUND) {
      throw new Error("Address not found: " + addressId.value);
    }

    this._addresses.splice(addressIndex, 1);
    this.addDomainEvent(new AddressRemovedEvent(this.id.value, addressId.value));
  }
}
