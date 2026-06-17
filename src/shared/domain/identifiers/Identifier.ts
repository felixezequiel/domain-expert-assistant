import { randomUUID } from "node:crypto";
import { DomainError } from "../errors/DomainError.ts";

export class Identifier {
  public readonly value: string;

  constructor(value?: string) {
    if (value !== undefined && value.length === 0) {
      // An empty id reaches here from client input (e.g. a `Command.of()` built from a
      // request body), so it is user-facing validation. kind "validation" keeps the 400
      // the Knowledge edge already produced (its message contains "cannot"); the Identity
      // edge previously returned 500 for this message — noted for the main agent.
      throw new DomainError("common.identifierEmpty", "validation", undefined, "Identifier value cannot be empty");
    }

    this.value = value ?? randomUUID();
  }

  public equals(other: Identifier): boolean {
    if (this.constructor !== other.constructor) {
      return false;
    }

    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
