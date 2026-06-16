import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkText, estimateTokens, DEFAULT_CHUNKING_OPTIONS } from "./Chunker.ts";

const SMALL_OPTIONS = { budgetTokens: 20, overlapTokens: 5 };

describe("estimateTokens", () => {
  it("approximates four characters per token", () => {
    assert.equal(estimateTokens("12345678"), 2);
    assert.equal(estimateTokens(""), 0);
  });
});

describe("chunkText", () => {
  it("keeps short text as a single chunk", () => {
    const chunks = chunkText("A short paragraph that fits.", DEFAULT_CHUNKING_OPTIONS);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]!.index, 0);
    assert.equal(chunks[0]!.content, "A short paragraph that fits.");
  });

  it("returns no chunks for empty or whitespace text", () => {
    assert.deepEqual(chunkText("", DEFAULT_CHUNKING_OPTIONS), []);
    assert.deepEqual(chunkText("   \n\n  ", DEFAULT_CHUNKING_OPTIONS), []);
  });

  it("trims surrounding whitespace of a single chunk", () => {
    const chunks = chunkText("   hello world   ", DEFAULT_CHUNKING_OPTIONS);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]!.content, "hello world");
  });

  it("splits long multi-paragraph text into multiple budgeted chunks", () => {
    const paragraph = "word ".repeat(15).trim();
    const text = [paragraph, paragraph, paragraph, paragraph].join("\n\n");
    const chunks = chunkText(text, SMALL_OPTIONS);
    assert.ok(chunks.length > 1, "expected more than one chunk");
    for (const chunk of chunks) {
      assert.ok(estimateTokens(chunk.content) <= SMALL_OPTIONS.budgetTokens + SMALL_OPTIONS.overlapTokens);
    }
  });

  it("assigns sequential indexes starting at zero", () => {
    const paragraph = "alpha beta gamma delta epsilon";
    const text = [paragraph, paragraph, paragraph, paragraph, paragraph].join("\n\n");
    const chunks = chunkText(text, SMALL_OPTIONS);
    for (let position = 0; position < chunks.length; position += 1) {
      assert.equal(chunks[position]!.index, position);
    }
  });

  it("carries overlap between consecutive chunks", () => {
    const blockA = "aaaa bbbb cccc dddd";
    const blockB = "eeee ffff gggg hhhh";
    const blockC = "iiii jjjj kkkk llll";
    const text = [blockA, blockB, blockC].join("\n\n");
    const chunks = chunkText(text, { budgetTokens: 12, overlapTokens: 6 });
    assert.ok(chunks.length >= 2);
    // The tail words of one chunk should reappear at the head of the next.
    const firstTailWord = chunks[0]!.content.trim().split(/\s+/).pop()!;
    assert.ok(
      chunks[1]!.content.includes(firstTailWord),
      "expected overlap word to appear in the next chunk",
    );
  });

  it("breaks a single oversized block on word boundaries", () => {
    const giant = "tok ".repeat(100).trim();
    const chunks = chunkText(giant, SMALL_OPTIONS);
    assert.ok(chunks.length > 1, "an oversized single block must be split");
    for (const chunk of chunks) {
      assert.ok(estimateTokens(chunk.content) <= SMALL_OPTIONS.budgetTokens + SMALL_OPTIONS.overlapTokens);
    }
  });
});
