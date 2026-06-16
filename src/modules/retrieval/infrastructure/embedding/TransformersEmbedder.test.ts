import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TransformersEmbedder } from "./TransformersEmbedder.ts";

describe("TransformersEmbedder", () => {
  it("exposes the 1024-dim BGE-M3 width without loading the model", () => {
    assert.equal(new TransformersEmbedder().dimensions, 1024);
  });

  it("short-circuits empty input without touching the model", async () => {
    // A bogus model name would throw if loaded — empty input must not load it.
    const embedder = new TransformersEmbedder("does-not-exist/model");
    assert.deepEqual(await embedder.embed([]), []);
  });

  it("throws a clear runtime error when the model cannot be loaded", async () => {
    const embedder = new TransformersEmbedder("does-not-exist/model-xyz");
    await assert.rejects(
      () => embedder.embed(["hello"]),
      (error: Error) => error.message.includes("could not be loaded"),
    );
  });
});
