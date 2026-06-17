import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertTagsExist } from "./assertTagsExist.ts";
import { FakeTagRepository } from "./testDoubles/index.ts";
import { Tag } from "../domain/aggregates/Tag.ts";
import { TagId } from "../domain/identifiers/TagId.ts";
import { DomainError } from "../../../shared/domain/errors/DomainError.ts";

describe("assertTagsExist", () => {
  it("passes when every tag exists", async () => {
    const repo = new FakeTagRepository();
    await repo.save(Tag.createTenantTag(new TagId("t1"), "company-1", "Refunds"));
    await repo.save(Tag.reconstitute(new TagId("sys"), null, "regra", "Regra", "system"));

    await assert.doesNotReject(() => assertTagsExist(repo, [new TagId("t1"), new TagId("sys")]));
  });

  it("is a no-op for an empty tag list", async () => {
    await assert.doesNotReject(() => assertTagsExist(new FakeTagRepository(), []));
  });

  it("throws naming the missing tags", async () => {
    const repo = new FakeTagRepository();
    await repo.save(Tag.createTenantTag(new TagId("t1"), "company-1", "Refunds"));

    await assert.rejects(
      () => assertTagsExist(repo, [new TagId("t1"), new TagId("ghost")]),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.unknownTags");
        assert.equal(error.kind, "validation");
        assert.deepEqual(error.params, { tags: "ghost" });
        assert.equal(error.message, "Unknown tag(s) for this organization: ghost");
        return true;
      },
    );
  });
});
