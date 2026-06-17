import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PublishedItemReaderAdapter } from "./PublishedItemReaderAdapter.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";
import type {
  GetKnowledgeItemUseCase,
  ListKnowledgeItemsUseCase,
  GetVersionHistoryUseCase,
} from "../../../knowledge/application/usecase/KnowledgeQueries.ts";
import type { KnowledgeItemView, KnowledgeVersionView } from "../../../knowledge/application/types.ts";

function itemView(overrides: Partial<KnowledgeItemView> = {}): KnowledgeItemView {
  return {
    id: "item-1",
    collectionId: "col-1",
    title: "Refund policy",
    body: "refund within 30 days",
    tagIds: [],
    sensitivity: "internal",
    status: "published",
    currentVersionNumber: 2,
    publishedVersionNumber: 2,
    isServed: true,
    isStale: false,
    lastRejectionReason: null,
    ...overrides,
  };
}

function version(versionNumber: number, createdAt: string): KnowledgeVersionView {
  return {
    itemId: "item-1",
    versionNumber,
    title: "Refund policy",
    body: "refund within 30 days",
    tagIds: [],
    sensitivity: "internal",
    createdBy: "curator-1",
    createdAt,
  };
}

function adapterWith(item: KnowledgeItemView | null, versions: ReadonlyArray<KnowledgeVersionView>) {
  const get = { execute: async () => item } as unknown as GetKnowledgeItemUseCase;
  const list = {
    execute: async () => (item === null ? [] : [item]),
  } as unknown as ListKnowledgeItemsUseCase;
  const history = { execute: async () => versions } as unknown as GetVersionHistoryUseCase;
  return new PublishedItemReaderAdapter(get, list, history);
}

describe("PublishedItemReaderAdapter", () => {
  it("maps a served item, taking companyId from the actor context and publishedAt from the version", async () => {
    const adapter = adapterWith(itemView(), [version(2, "2026-06-16T10:00:00.000Z")]);
    const item = await runWithActor(
      { companyId: "company-1", actorId: "system", actorType: "system" },
      () => adapter.getPublishedItem("item-1"),
    );
    assert.ok(item !== null);
    assert.equal(item!.companyId, "company-1");
    assert.equal(item!.publishedVersion, 2);
    assert.equal(item!.publishedAt, "2026-06-16T10:00:00.000Z");
    assert.equal(item!.body, "refund within 30 days");
    assert.equal(item!.stale, false);
  });

  it("returns null for an item that is not served", async () => {
    const adapter = adapterWith(itemView({ isServed: false, publishedVersionNumber: null }), []);
    const item = await runWithActor(
      { companyId: "company-1", actorId: "system", actorType: "system" },
      () => adapter.getPublishedItem("item-1"),
    );
    assert.equal(item, null);
  });

  it("flags a deprecated served item as stale", async () => {
    const adapter = adapterWith(
      itemView({ status: "deprecated", isStale: true }),
      [version(2, "2026-06-16T10:00:00.000Z")],
    );
    const item = await runWithActor(
      { companyId: "company-1", actorId: "system", actorType: "system" },
      () => adapter.getPublishedItem("item-1"),
    );
    assert.equal(item!.stale, true);
  });

  it("lists only served items for the tenant", async () => {
    const adapter = adapterWith(itemView(), [version(2, "2026-06-16T10:00:00.000Z")]);
    const items = await runWithActor(
      { companyId: "company-1", actorId: "system", actorType: "system" },
      () => adapter.listServedItems("company-1"),
    );
    assert.equal(items.length, 1);
    assert.equal(items[0]!.itemId, "item-1");
  });
});
