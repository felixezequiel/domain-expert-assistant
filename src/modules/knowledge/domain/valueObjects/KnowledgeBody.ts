import { ValueObject } from "../../../../shared/domain/valueObjects/ValueObject.ts";

interface KnowledgeBodyProps {
  readonly value: string;
}

/**
 * Free-form item body (markdown/plain text). Trimmed only at the ends; internal formatting
 * is preserved. Must be non-empty — an item always carries content.
 */
export class KnowledgeBody extends ValueObject<KnowledgeBodyProps> {
  public get value(): string {
    return this.props.value;
  }

  constructor(value: string) {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new Error("Body cannot be empty");
    }
    super({ value: trimmed });
  }
}
