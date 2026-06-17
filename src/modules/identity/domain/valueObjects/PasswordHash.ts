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
      // Programmer guard, never user-triggered: the hash always comes from the
      // PasswordHasherPort, never from request input. Left as a plain Error → 500 (ADR-026
      // exempts pure internal guards).
      throw new Error("Password hash cannot be empty");
    }
    super({ value });
  }
}
