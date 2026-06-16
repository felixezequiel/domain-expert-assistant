import type { EmbedderPort } from "../../application/types.ts";

/**
 * Local, free, multilingual embedder (ADR-017): BGE-M3 (1024-dim, no query prefix) run in
 * process via `@huggingface/transformers` v3 — never a paid API. The model (~1 GB) is
 * lazy-loaded on the first `embed` call and cached for the process, so importing this adapter
 * is cheap and a slow/absent model never blocks startup. Mean-pooled + L2-normalised so the
 * vectors match the pgvector cosine distance used by hybrid search (ADR-019). If the model
 * cannot be loaded (offline first run, missing files), `embed` throws a clear runtime error;
 * the projection worker records that on the item rather than crashing, and a later rebuild
 * cures it (ADR-020).
 */
const BGE_M3_MODEL = "Xenova/bge-m3";
const EMBEDDING_DIMENSIONS = 1024;

type FeatureExtractor = (
  texts: ReadonlyArray<string>,
  options: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist(): Array<Array<number>> }>;

export class TransformersEmbedder implements EmbedderPort {
  public readonly dimensions = EMBEDDING_DIMENSIONS;
  private readonly modelName: string;
  private extractor: FeatureExtractor | null = null;
  private loading: Promise<FeatureExtractor> | null = null;

  constructor(modelName: string = BGE_M3_MODEL) {
    this.modelName = modelName;
  }

  public async embed(texts: ReadonlyArray<string>): Promise<ReadonlyArray<ReadonlyArray<number>>> {
    if (texts.length === 0) {
      return [];
    }
    const extractor = await this.loadExtractor();
    const output = await extractor([...texts], { pooling: "mean", normalize: true });
    return output.tolist();
  }

  private async loadExtractor(): Promise<FeatureExtractor> {
    if (this.extractor !== null) {
      return this.extractor;
    }
    if (this.loading === null) {
      this.loading = this.initExtractor();
    }
    this.extractor = await this.loading;
    return this.extractor;
  }

  private async initExtractor(): Promise<FeatureExtractor> {
    try {
      const transformers = await import("@huggingface/transformers");
      const pipe = await transformers.pipeline("feature-extraction", this.modelName);
      return pipe as unknown as FeatureExtractor;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      throw new Error(
        "Local embedding model '" + this.modelName + "' could not be loaded: " + reason,
      );
    }
  }
}
