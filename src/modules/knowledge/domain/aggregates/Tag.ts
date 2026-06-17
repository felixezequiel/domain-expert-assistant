import { AggregateRoot } from "../../../../shared/domain/aggregates/AggregateRoot.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";
import type { TagId } from "../identifiers/TagId.ts";
import { TenantTagCreatedEvent } from "../events/TenantTagCreatedEvent.ts";
import { TenantTagRemovedEvent } from "../events/TenantTagRemovedEvent.ts";

export type TagScope = "system" | "tenant";

interface TagProps {
  readonly companyId: string | null;
  readonly slug: string;
  readonly label: string;
  readonly scope: TagScope;
}

/**
 * A classification facet (ADR-014). `system` tags are an immutable, product-seeded
 * vocabulary shared by all tenants (`companyId = null`); `tenant` tags are created/removed
 * by an org. `companyId` is intentionally `string | null` (not `TenantScoped`): the event
 * enricher treats a string companyId as tenant-scoped (cross-checked) and null as not, so
 * tenant tags are isolated while system tags are shared by construction.
 */
export class Tag extends AggregateRoot<TagId, TagProps> {
  public get companyId(): string | null {
    return this.props.companyId;
  }

  public get slug(): string {
    return this.props.slug;
  }

  public get label(): string {
    return this.props.label;
  }

  public get scope(): TagScope {
    return this.props.scope;
  }

  public isSystem(): boolean {
    return this.props.scope === "system";
  }

  public static createTenantTag(id: TagId, companyId: string, label: string): Tag {
    const cleanLabel = label.trim();
    const slug = Tag.slugify(cleanLabel);
    if (slug.length === 0) {
      throw new DomainError(
        "knowledge.tagLabelEmptySlug",
        "validation",
        undefined,
        "Tag label must produce a non-empty slug",
      );
    }
    const tag = new Tag(id, { companyId, slug, label: cleanLabel, scope: "tenant" });
    tag.addDomainEvent(new TenantTagCreatedEvent(id.value, slug, cleanLabel));
    return tag;
  }

  public static reconstitute(
    id: TagId,
    companyId: string | null,
    slug: string,
    label: string,
    scope: TagScope,
  ): Tag {
    return new Tag(id, { companyId, slug, label, scope });
  }

  public requestRemoval(): void {
    if (this.isSystem()) {
      throw new DomainError(
        "knowledge.cannotRemoveSystemTag",
        "validation",
        { slug: this.props.slug },
        "Cannot remove a system tag: " + this.props.slug,
      );
    }
    this.markForDeletion();
    this.addDomainEvent(new TenantTagRemovedEvent(this.id.value));
  }

  private static slugify(label: string): string {
    return label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}
