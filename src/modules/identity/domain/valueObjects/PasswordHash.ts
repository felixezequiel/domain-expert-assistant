import { ValueObject } from "../../../../shared/domain/valueObjects/ValueObject.ts";

interface PasswordHashProps {
  readonly value: string;
}

/**
 * Opaque password hash (argon2id, ADR-010). The domain only ever holds the hash, never
 * the plaintext; hashing/verification live behind a PasswordHasherPort in the application.
 */
export class PasswordHash extends ValueObject<PasswordHashProps> {
  public get value(): string {
    return this.props.value;
  }

  constructor(value: string) {
    if (value.length === 0) {
      throw new Error("Password hash cannot be empty");
    }
    super({ value });
  }
}
