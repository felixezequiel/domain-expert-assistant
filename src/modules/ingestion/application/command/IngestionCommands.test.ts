import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UploadDocumentCommand, ProcessIngestionJobCommand } from "./IngestionCommands.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

describe("Ingestion commands", () => {
  it("UploadDocumentCommand builds with a validated mime type and non-empty content", () => {
    const command = UploadDocumentCommand.of("c1", "  doc.md ", "text/markdown", Buffer.from("hi"));
    assert.equal(command.collectionId, "c1");
    assert.equal(command.filename, "doc.md");
    assert.equal(command.mimeType.value, "text/markdown");
    assert.equal(command.content.toString(), "hi");
  });

  it("UploadDocumentCommand rejects empty content / missing fields / bad mime", () => {
    assert.throws(() => UploadDocumentCommand.of("c1", "d.md", "text/markdown", Buffer.alloc(0)), /empty/);
    assert.throws(() => UploadDocumentCommand.of("", "d.md", "text/markdown", Buffer.from("x")), /collectionId/);
    assert.throws(() => UploadDocumentCommand.of("c1", "d.md", "image/png", Buffer.from("x")), /Unsupported/);
  });

  it("UploadDocumentCommand rejects content larger than the (injectable) max byte limit", () => {
    const maxBytes = 4;
    const oversize = Buffer.from("hello");
    assert.throws(
      () => UploadDocumentCommand.of("c1", "d.md", "text/markdown", oversize, maxBytes),
      /too large/,
    );
  });

  it("UploadDocumentCommand accepts content at or under the max byte limit", () => {
    const maxBytes = 5;
    const atLimit = Buffer.from("hello");
    const command = UploadDocumentCommand.of("c1", "d.md", "text/markdown", atLimit, maxBytes);
    assert.equal(command.content.length, maxBytes);
  });

  it("emits coded DomainErrors preserving the original English messages", () => {
    try {
      UploadDocumentCommand.of("", "d.md", "text/markdown", Buffer.from("x"));
      assert.fail("expected DomainError");
    } catch (error) {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, "common.fieldRequired");
      assert.equal(error.kind, "validation");
      assert.deepEqual(error.params, { field: "collectionId" });
      assert.equal(error.message, "collectionId is required");
    }

    try {
      UploadDocumentCommand.of("c1", "d.md", "text/markdown", Buffer.alloc(0));
      assert.fail("expected DomainError");
    } catch (error) {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, "ingestion.emptyContent");
      assert.equal(error.kind, "validation");
      assert.equal(error.params, undefined);
      assert.equal(error.message, "Document content is empty");
    }

    try {
      UploadDocumentCommand.of("c1", "d.md", "text/markdown", Buffer.from("hello"), 4);
      assert.fail("expected DomainError");
    } catch (error) {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, "ingestion.contentTooLarge");
      assert.equal(error.kind, "validation");
      assert.deepEqual(error.params, { size: 5, maxBytes: 4 });
      assert.equal(error.message, "Document content is too large: 5 bytes exceeds the limit of 4 bytes");
    }
  });

  it("ProcessIngestionJobCommand wraps the job id", () => {
    assert.equal(ProcessIngestionJobCommand.of("j1").jobId.value, "j1");
  });
});
