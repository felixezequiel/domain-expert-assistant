/**
 * An immutable, append-only snapshot of a KnowledgeItem's versioned content (title + body
 * + tags + sensitivity) at a point in time (ADR-012). Stored outside the aggregate and
 * read on demand (history, rollback); never updated destructively. Held as primitives so
 * the version store stays a simple append log; the use case rebuilds VOs on rollback.
 */
export class KnowledgeVersion {
  public readonly itemId: string;
  public readonly versionNumber: number;
  public readonly title: string;
  public readonly body: string;
  public readonly tagIds: ReadonlyArray<string>;
  public readonly sensitivity: string;
  public readonly createdBy: string;
  public readonly createdAt: Date;

  constructor(params: {
    itemId: string;
    versionNumber: number;
    title: string;
    body: string;
    tagIds: ReadonlyArray<string>;
    sensitivity: string;
    createdBy: string;
    createdAt: Date;
  }) {
    this.itemId = params.itemId;
    this.versionNumber = params.versionNumber;
    this.title = params.title;
    this.body = params.body;
    this.tagIds = [...params.tagIds];
    this.sensitivity = params.sensitivity;
    this.createdBy = params.createdBy;
    this.createdAt = params.createdAt;
  }
}
