import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValueObject } from "./ValueObject.ts";

interface MoneyProps {
  readonly amount: number;
  readonly currency: string;
}

class Money extends ValueObject<MoneyProps> {
  public get amount(): number {
    return this.props.amount;
  }

  public get currency(): string {
    return this.props.currency;
  }
}

interface AddressProps {
  readonly street: string;
  readonly city: string;
}

class Address extends ValueObject<AddressProps> {}

describe("ValueObject", () => {
  it("should store the provided properties", () => {
    const money = new Money({ amount: 100, currency: "BRL" });

    assert.equal(money.amount, 100);
    assert.equal(money.currency, "BRL");
  });

  it("should be equal to another value object with the same properties", () => {
    const firstMoney = new Money({ amount: 100, currency: "BRL" });
    const secondMoney = new Money({ amount: 100, currency: "BRL" });

    assert.ok(firstMoney.equals(secondMoney));
  });

  it("should not be equal when a property differs", () => {
    const firstMoney = new Money({ amount: 100, currency: "BRL" });
    const secondMoney = new Money({ amount: 200, currency: "BRL" });

    assert.ok(!firstMoney.equals(secondMoney));
  });

  it("should not be equal to a value object of a different type", () => {
    const money = new Money({ amount: 100, currency: "BRL" });
    const address = new Address({ street: "100", city: "BRL" });

    assert.ok(!money.equals(address as unknown as Money));
  });

  it("should be immutable - props object cannot be reassigned", () => {
    const money = new Money({ amount: 100, currency: "BRL" });

    assert.throws(() => {
      (money as unknown as { props: MoneyProps }).props = { amount: 200, currency: "BRL" };
    });
  });
});
