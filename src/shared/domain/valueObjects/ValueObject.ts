export abstract class ValueObject<Props extends object> {
  protected readonly props!: Props;

  constructor(props: Props) {
    const frozenProps = Object.freeze({ ...props });
    Object.defineProperty(this, "props", {
      value: frozenProps,
      writable: false,
      enumerable: true,
      configurable: false,
    });
  }

  public equals(other: ValueObject<Props>): boolean {
    if (this.constructor !== other.constructor) {
      return false;
    }

    const thisRecord = this.props as Record<string, unknown>;
    const otherRecord = other.props as Record<string, unknown>;

    const thisKeys = Object.keys(thisRecord);
    const otherKeys = Object.keys(otherRecord);

    if (thisKeys.length !== otherKeys.length) {
      return false;
    }

    for (const key of thisKeys) {
      if (thisRecord[key] !== otherRecord[key]) {
        return false;
      }
    }

    return true;
  }
}
