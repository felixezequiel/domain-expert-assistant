import { randomUUID } from "node:crypto";

export class Identifier {
  public readonly value: string;

  constructor(value?: string) {
    if (value !== undefined && value.length === 0) {
      throw new Error("Identifier value cannot be empty");
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
