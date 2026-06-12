import { UserId } from "../../domain/identifiers/UserId.ts";
import { AddressId } from "../../domain/identifiers/AddressId.ts";
import { Street } from "../../domain/valueObjects/Street.ts";
import { AddressNumber } from "../../domain/valueObjects/AddressNumber.ts";
import { City } from "../../domain/valueObjects/City.ts";
import { State } from "../../domain/valueObjects/State.ts";
import { ZipCode } from "../../domain/valueObjects/ZipCode.ts";

export class AddAddressCommand {
  public readonly userId: UserId;
  public readonly addressId: AddressId;
  public readonly street: Street;
  public readonly number: AddressNumber;
  public readonly city: City;
  public readonly state: State;
  public readonly zipCode: ZipCode;

  private constructor(
    userId: UserId,
    addressId: AddressId,
    street: Street,
    number: AddressNumber,
    city: City,
    state: State,
    zipCode: ZipCode,
  ) {
    this.userId = userId;
    this.addressId = addressId;
    this.street = street;
    this.number = number;
    this.city = city;
    this.state = state;
    this.zipCode = zipCode;
  }

  public static of(
    userId: string,
    addressId: string,
    street: string,
    number: string,
    city: string,
    state: string,
    zipCode: string,
  ): AddAddressCommand {
    return new AddAddressCommand(
      new UserId(userId),
      new AddressId(addressId),
      new Street(street),
      new AddressNumber(number),
      new City(city),
      new State(state),
      new ZipCode(zipCode),
    );
  }
}
