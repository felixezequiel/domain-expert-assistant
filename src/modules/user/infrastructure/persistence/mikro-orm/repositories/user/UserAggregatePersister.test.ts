import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserAggregatePersister } from "./UserAggregatePersister.ts";
import { User } from "../../../../../domain/aggregates/User.ts";
import { UserId } from "../../../../../domain/identifiers/UserId.ts";
import { Email } from "../../../../../domain/valueObjects/Email.ts";
import { AggregateRoot } from "../../../../../../../shared/domain/aggregates/AggregateRoot.ts";
import { Identifier } from "../../../../../../../shared/domain/identifiers/Identifier.ts";

class OtherAggregate extends AggregateRoot<Identifier, { readonly value: string }> {}

describe("UserAggregatePersister", () => {
  it("should support User aggregates", () => {
    const persister = new UserAggregatePersister();
    const user = User.create(new UserId("user-1"), "John", new Email("john@example.com"));

    assert.ok(persister.supports(user));
  });

  it("should not support non-User aggregates", () => {
    const persister = new UserAggregatePersister();
    const other = new OtherAggregate(new Identifier("other-1"), { value: "test" });

    assert.ok(!persister.supports(other));
  });
});
