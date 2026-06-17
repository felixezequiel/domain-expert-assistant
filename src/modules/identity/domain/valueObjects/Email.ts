import { ValueObject } from "../../../../shared/domain/valueObjects/ValueObject.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

interface EmailProps {
  readonly value: string;
}

const MINIMUM_EMAIL_PARTS = 2;

/**
 * Identity's own Email VO (bounded contexts don't share VOs except via the shared
 * kernel). Normalises to lowercase so uniqueness-per-org is case-insensitive.
 */
export class Email extends ValueObject<EmailProps> {
  public get value(): string {
    return this.props.value;
  }

  constructor(value: string) {
    const normalized = value.trim().toLowerCase();
    const parts = normalized.split("@");
    const localPart = parts[0];
    const domainPart = parts[1];
    const isValid =
      parts.length === MINIMUM_EMAIL_PARTS &&
      localPart !== undefined &&
      localPart.length > 0 &&
      domainPart !== undefined &&
      domainPart.length > 0;

    if (!isValid) {
      throw new DomainError(
        "identity.invalidEmailFormat",
        "validation",
        { value },
        "Invalid email format: " + value,
      );
    }

    super({ value: normalized });
  }
}
