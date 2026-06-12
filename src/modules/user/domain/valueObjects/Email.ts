import { ValueObject } from "../../../../shared/domain/valueObjects/ValueObject.ts";

interface EmailProps {
  readonly value: string;
}

const MINIMUM_EMAIL_PARTS = 2;

export class Email extends ValueObject<EmailProps> {
  public get value(): string {
    return this.props.value;
  }

  constructor(value: string) {
    const parts = value.split("@");
    const localPart = parts[0];
    const domainPart = parts[1];
    const hasValidStructure =
      parts.length >= MINIMUM_EMAIL_PARTS &&
      localPart !== undefined &&
      localPart.length > 0 &&
      domainPart !== undefined &&
      domainPart.length > 0;

    if (!hasValidStructure) {
      throw new Error("Invalid email format: " + value);
    }

    super({ value });
  }
}
