import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Entity } from "./Entity.ts";
import { Identifier } from "../identifiers/Identifier.ts";

class ProductId extends Identifier {}

interface ProductProps {
  readonly name: string;
  readonly price: number;
}

class Product extends Entity<ProductId, ProductProps> {
  public get name(): string {
    return this.props.name;
  }

  public get price(): number {
    return this.props.price;
  }
}

describe("Entity", () => {
  it("should store id and properties", () => {
    const productId = new ProductId("prod-1");
    const product = new Product(productId, { name: "Widget", price: 10 });

    assert.equal(product.id.value, "prod-1");
    assert.equal(product.name, "Widget");
    assert.equal(product.price, 10);
  });

  it("should be equal to another entity with the same id", () => {
    const firstProduct = new Product(new ProductId("prod-1"), { name: "Widget", price: 10 });
    const secondProduct = new Product(new ProductId("prod-1"), {
      name: "Updated Widget",
      price: 20,
    });

    assert.ok(firstProduct.equals(secondProduct));
  });

  it("should not be equal to an entity with a different id", () => {
    const firstProduct = new Product(new ProductId("prod-1"), { name: "Widget", price: 10 });
    const secondProduct = new Product(new ProductId("prod-2"), { name: "Widget", price: 10 });

    assert.ok(!firstProduct.equals(secondProduct));
  });

  it("should not be equal to an entity of a different type", () => {
    class OrderItemId extends Identifier {}

    interface OrderItemProps {
      readonly name: string;
      readonly price: number;
    }

    class OrderItem extends Entity<OrderItemId, OrderItemProps> {}

    const product = new Product(new ProductId("id-1"), { name: "Widget", price: 10 });
    const orderItem = new OrderItem(new OrderItemId("id-1"), { name: "Widget", price: 10 });

    assert.ok(!product.equals(orderItem as unknown as Product));
  });
});
