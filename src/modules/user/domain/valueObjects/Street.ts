import { ValueObject } from "../../../../shared/domain/valueObjects/ValueObject.ts";

interface StreetProps {
  readonly value: string;
}

export class Street extends ValueObject<StreetProps> {
  public get value(): string {
    return this.props.value;
  }

  constructor(value: string) {
    if (value.length === 0) {
      throw new Error("Street cannot be empty");
    }

    super({ value });
  }
}
