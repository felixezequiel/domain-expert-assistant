import type { Identifier } from "../identifiers/Identifier.ts";

export abstract class Entity<Id extends Identifier, Props extends object> {
  public readonly id: Id;
  protected readonly props: Props;

  constructor(id: Id, props: Props) {
    this.id = id;
    this.props = props;
  }

  public equals(other: Entity<Id, Props>): boolean {
    if (this.constructor !== other.constructor) {
      return false;
    }

    return this.id.equals(other.id);
  }
}
