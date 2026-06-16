/**
 * Structure-aware chunker (ADR-017). The strategy: split first on document structure
 * (blank-line-separated blocks — paragraphs/headings), then greedily pack blocks into a
 * token budget, carrying a small overlap of trailing words between consecutive chunks so a
 * sentence cut at a boundary still has context on both sides. Short text stays one chunk.
 *
 * Token counting is a heuristic — roughly four characters per token, the common rule of
 * thumb for multilingual text — because pulling the real BGE-M3 tokenizer into the domain
 * would couple it to the model and the runtime. The budget favours modest, precise chunks
 * since v1 has no reranker to fix precision at query time (ADR-019).
 */
const CHARS_PER_TOKEN = 4;
const DEFAULT_BUDGET_TOKENS = 512;
const DEFAULT_OVERLAP_TOKENS = 64;

export interface ChunkingOptions {
  readonly budgetTokens: number;
  readonly overlapTokens: number;
}

export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  budgetTokens: DEFAULT_BUDGET_TOKENS,
  overlapTokens: DEFAULT_OVERLAP_TOKENS,
};

export interface Chunk {
  readonly index: number;
  readonly content: string;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function splitIntoBlocks(text: string): ReadonlyArray<string> {
  const blocks: Array<string> = [];
  for (const rawBlock of text.split(/\n\s*\n/)) {
    const block = rawBlock.trim();
    if (block.length > 0) {
      blocks.push(block);
    }
  }
  return blocks;
}

/**
 * A single block can exceed the budget on its own (a long unbroken paragraph). Break it on
 * word boundaries into budget-sized pieces so no piece overflows the model's effective unit.
 */
function splitOversizedBlock(block: string, budgetTokens: number): ReadonlyArray<string> {
  if (estimateTokens(block) <= budgetTokens) {
    return [block];
  }
  const budgetChars = budgetTokens * CHARS_PER_TOKEN;
  const words = block.split(/\s+/);
  const pieces: Array<string> = [];
  let current = "";
  for (const word of words) {
    const candidate = current.length === 0 ? word : current + " " + word;
    if (candidate.length > budgetChars && current.length > 0) {
      pieces.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) {
    pieces.push(current);
  }
  return pieces;
}

function overlapTail(text: string, overlapTokens: number): string {
  if (overlapTokens <= 0) {
    return "";
  }
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;
  if (text.length <= overlapChars) {
    return text;
  }
  const words = text.split(/\s+/);
  let tail = "";
  for (let position = words.length - 1; position >= 0; position -= 1) {
    const candidate = tail.length === 0 ? words[position]! : words[position]! + " " + tail;
    if (candidate.length > overlapChars) {
      break;
    }
    tail = candidate;
  }
  return tail;
}

/**
 * Greedily packs structure blocks up to the token budget. Each emitted chunk after the first
 * is seeded with the previous chunk's overlap tail so context survives the boundary.
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = DEFAULT_CHUNKING_OPTIONS,
): ReadonlyArray<Chunk> {
  const normalized = text.trim();
  if (normalized.length === 0) {
    return [];
  }
  if (estimateTokens(normalized) <= options.budgetTokens) {
    return [{ index: 0, content: normalized }];
  }

  const blocks: Array<string> = [];
  for (const block of splitIntoBlocks(normalized)) {
    for (const piece of splitOversizedBlock(block, options.budgetTokens)) {
      blocks.push(piece);
    }
  }

  const chunks: Array<Chunk> = [];
  let current = "";
  let previousTail = "";

  const flush = (): void => {
    if (current.length === 0) {
      return;
    }
    chunks.push({ index: chunks.length, content: current });
    previousTail = overlapTail(current, options.overlapTokens);
  };

  const startWithSeededBlock = (block: string): string => {
    if (previousTail.length > 0) {
      return previousTail + "\n\n" + block;
    }
    return block;
  };

  const appendBlock = (base: string, block: string): string => {
    if (base.length === 0) {
      return block;
    }
    return base + "\n\n" + block;
  };

  for (const block of blocks) {
    let base = current;
    if (current.length === 0 && chunks.length > 0 && previousTail.length > 0) {
      base = previousTail;
    }
    const candidate = appendBlock(base, block);
    if (estimateTokens(candidate) > options.budgetTokens && current.length > 0) {
      flush();
      current = startWithSeededBlock(block);
    } else {
      current = candidate;
    }
  }
  flush();

  return chunks;
}
