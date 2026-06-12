import { ValueObject } from "../../../../shared/domain/valueObjects/ValueObject.ts";

interface AddressNumberProps {
  readonly value: string;
}

export class AddressNumber extends ValueObject<AddressNumberProps> {
  public get value(): string {
    return this.props.value;
  }

  constructor(value: string) {
    super({ value });
  }
}
