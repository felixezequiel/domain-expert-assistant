import { PlainObject } from "@mikro-orm/core";

/**
 * ORM entity for a row in the derived `chunks` index. The `embedding` and `content_tsv`
 * columns are written/read through raw SQL in the repository (pgvector has no MikroORM
 * mapping and the RRF fusion is composed in-DB), so they are not modelled as properties
 * here — this entity exists for schema registration and the scalar metadata columns.
 */
export class ChunkEntity extends PlainObject {
  public id!: string;
  public companyId!: string;
  public itemId!: string;
  public chunkIndex!: number;
  public title!: string;
  public collectionId!: string;
  public sensitivity!: string;
  public content!: string;
  public publishedVersion!: number;
  public publishedAt!: string;
  public stale!: boolean;
}
