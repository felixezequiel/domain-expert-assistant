import { ValueObject } from "../../../../shared/domain/valueObjects/ValueObject.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

interface TitleProps {
  readonly value: string;
}

const MAX_TITLE_LENGTH = 200;

export class Title extends ValueObject<TitleProps> {
  public get value(): string {
    return this.props.value;
  }

  constructor(value: string) {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_TITLE_LENGTH) {
      throw new DomainError(
        "knowledge.titleLength",
        "validation",
        { max: MAX_TITLE_LENGTH },
        "Title must be 1.." + MAX_TITLE_LENGTH + " characters",
      );
    }
    super({ value: trimmed });
  }
}
