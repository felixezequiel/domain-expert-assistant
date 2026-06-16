import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DocumentUploadedEvent,
  IngestionStartedEvent,
  IngestionCompletedEvent,
  IngestionFailedEvent,
} from "./IngestionEvents.ts";

describe("IngestionEvents", () => {
  it("names each event and carries its payload", () => {
    const uploaded = new DocumentUploadedEvent("j1", "doc.md", "text/markdown");
    assert.equal(uploaded.eventName, "DocumentUploaded");
    assert.equal(uploaded.filename, "doc.md");
    assert.equal(uploaded.mimeType, "text/markdown");

    assert.equal(new IngestionStartedEvent("j1").eventName, "IngestionStarted");
    assert.equal(new IngestionCompletedEvent("j1", "item-1").createdItemId, "item-1");
    assert.equal(new IngestionFailedEvent("j1", "boom").reason, "boom");
  });
});
