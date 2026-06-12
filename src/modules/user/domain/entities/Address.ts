import { Entity } from "../../../../shared/domain/entities/Entity.ts";
import type { AddressId } from "../identifiers/AddressId.ts";
import type { Street } from "../valueObjects/Street.ts";
import type { AddressNumber } from "../valueObjects/AddressNumber.ts";
import type { City } from "../valueObjects/City.ts";
import type { State } from "../valueObjects/State.ts";
import type { ZipCode } from "../valueObjects/ZipCode.ts";

interface AddressProps {
  readonly street: Street;
  readonly number: AddressNumber;
  readonly city: City;
  readonly state: State;
  readonly zipCode: ZipCode;
}

export class Address extends Entity<AddressId, AddressProps> {
  public get street(): Street {
    return this.props.street;
  }

  public get number(): AddressNumber {
    return this.props.number;
  }

  public get city(): City {
    return this.props.city;
  }

  public get state(): State {
    return this.props.state;
  }

  public get zipCode(): ZipCode {
    return this.props.zipCode;
  }

  public static create(
    id: AddressId,
    street: Street,
    number: AddressNumber,
    city: City,
    state: State,
    zipCode: ZipCode,
  ): Address {
    return new Address(id, { street, number, city, state, zipCode });
  }

  public static reconstitute(
    id: AddressId,
    street: Street,
    number: AddressNumber,
    city: City,
    state: State,
    zipCode: ZipCode,
  ): Address {
    return new Address(id, { street, number, city, state, zipCode });
  }
}
