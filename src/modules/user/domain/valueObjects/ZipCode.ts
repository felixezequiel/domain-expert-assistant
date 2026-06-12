import { ValueObject } from "../../../../shared/domain/valueObjects/ValueObject.ts";

interface ZipCodeProps {
  readonly value: string;
}

export class ZipCode extends ValueObject<ZipCodeProps> {
  public get value(): string {
    return this.props.value;
  }

  constructor(value: string) {
    if (value.length === 0) {
      throw new Error("ZipCode cannot be empty");
    }

    super({ value });
  }
}
