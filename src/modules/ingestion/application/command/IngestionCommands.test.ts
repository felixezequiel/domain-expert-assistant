import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UploadDocumentCommand, ProcessIngestionJobCommand } from "./IngestionCommands.ts";

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

  it("ProcessIngestionJobCommand wraps the job id", () => {
    assert.equal(ProcessIngestionJobCommand.of("j1").jobId.value, "j1");
  });
});
