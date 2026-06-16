import { EntitySchema } from "@mikro-orm/core";
import { ChunkEntity } from "../entities/ChunkEntity.ts";
import {
  COMPANY_TENANT_FILTER_NAME,
  companyTenantFilterDefinition,
} from "../../../../../../shared/infrastructure/persistence/filters/CompanyFilter.ts";

/**
 * Schema for the derived `chunks` index. Only the scalar metadata columns are modelled; the
 * `embedding vector(1024)` and generated `content_tsv` columns are created by the migration
 * and handled with raw SQL in the repository (pgvector has no ORM mapping). The company
 * filter is declared for ORM-routed reads, but the raw hybrid-search query enforces tenant +
 * scope explicitly in its WHERE because the pgvector query bypasses the ORM filter (ADR-022).
 */
export const ChunkEntitySchema = new EntitySchema<ChunkEntity>({
  class: ChunkEntity,
  tableName: "chunks",
  properties: {
    id: { type: "string", primary: true },
    companyId: { type: "string", fieldName: "company_id" },
    itemId: { type: "string", fieldName: "item_id" },
    chunkIndex: { type: "number", fieldName: "chunk_index" },
    title: { type: "string" },
    collectionId: { type: "string", fieldName: "collection_id" },
    sensitivity: { type: "string" },
    content: { type: "text" },
    publishedVersion: { type: "number", fieldName: "published_version" },
    publishedAt: { type: "string", fieldName: "published_at" },
    stale: { type: "boolean" },
  },
  filters: { [COMPANY_TENANT_FILTER_NAME]: companyTenantFilterDefinition },
});
