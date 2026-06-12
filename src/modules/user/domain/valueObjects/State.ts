import { ValueObject } from "../../../../shared/domain/valueObjects/ValueObject.ts";

interface StateProps {
  readonly value: string;
}

export class State extends ValueObject<StateProps> {
  public get value(): string {
    return this.props.value;
  }

  constructor(value: string) {
    if (value.length === 0) {
      throw new Error("State cannot be empty");
    }

    super({ value });
  }
}
