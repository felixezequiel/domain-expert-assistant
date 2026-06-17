import { ValueObject } from "../../../../shared/domain/valueObjects/ValueObject.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

interface DisplayNameProps {
  readonly value: string;
}

const MAX_DISPLAY_NAME_LENGTH = 120;

export class DisplayName extends ValueObject<DisplayNameProps> {
  public get value(): string {
    return this.props.value;
  }

  constructor(value: string) {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
      throw new DomainError(
        "identity.displayNameLength",
        "internal",
        { max: MAX_DISPLAY_NAME_LENGTH },
        "Display name must be 1.." + MAX_DISPLAY_NAME_LENGTH + " characters",
      );
    }
    super({ value: trimmed });
  }
}
