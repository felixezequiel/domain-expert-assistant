import { ValueObject } from "../../../../shared/domain/valueObjects/ValueObject.ts";

interface CityProps {
  readonly value: string;
}

export class City extends ValueObject<CityProps> {
  public get value(): string {
    return this.props.value;
  }

  constructor(value: string) {
    if (value.length === 0) {
      throw new Error("City cannot be empty");
    }

    super({ value });
  }
}
