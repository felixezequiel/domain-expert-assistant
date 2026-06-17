import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { collectionsApi, itemsApi, tagsApi } from "../../api/resources.ts";
import type { KnowledgeItemView } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary } from "../../components/AsyncBoundary.tsx";
import { statusBadge } from "../../lib/format.ts";
import { Badge } from "../../components/ui/badge.tsx";
import { Card, CardContent } from "../../components/ui/card.tsx";
import { Label } from "../../components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select.tsx";

const ALL_COLLECTIONS = "all";
const ALL_TAGS = "all";

// Merge published + deprecated so the catalog matches what search serves (finding S3):
// deprecated-but-still-served items show up in results, so they must be browsable too.
function mergeServed(
  published: ReadonlyArray<KnowledgeItemView>,
  deprecated: ReadonlyArray<KnowledgeItemView>,
): ReadonlyArray<KnowledgeItemView> {
  const byId = new Map<string, KnowledgeItemView>();
  for (const item of [...published, ...deprecated]) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

// Catalog browse by collection (and tag, client-side). Shows the items the session is
// allowed to see; the read view is one click away.
export function CatalogPage(): JSX.Element {
  const { t } = useTranslation();
  const collections = useAsync(() => collectionsApi.list(), []);
  const tags = useAsync(() => tagsApi.list(), []);
  const [collectionId, setCollectionId] = useState(ALL_COLLECTIONS);
  const [tagId, setTagId] = useState(ALL_TAGS);

  const collectionFilter = collectionId === ALL_COLLECTIONS ? undefined : collectionId;
  const items = useAsync(
    () =>
      Promise.all([
        itemsApi.list(collectionFilter, "published"),
        itemsApi.list(collectionFilter, "deprecated"),
      ]),
    [collectionFilter],
  );

  const collectionNames = new Map<string, string>(
    (collections.data?.collections ?? []).map((collection) => [collection.id, collection.name]),
  );

  const merged = items.data === null ? [] : mergeServed(items.data[0].items, items.data[1].items);
  const visibleItems = merged.filter((item) => tagId === ALL_TAGS || item.tagIds.includes(tagId));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("consumer.catalog.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("consumer.catalog.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="catalog-collection">{t("consumer.catalog.collectionLabel")}</Label>
          <Select value={collectionId} onValueChange={setCollectionId}>
            <SelectTrigger id="catalog-collection" aria-label={t("consumer.catalog.collectionLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_COLLECTIONS}>{t("consumer.catalog.allCollections")}</SelectItem>
              {(collections.data?.collections ?? []).map((collection) => (
                <SelectItem key={collection.id} value={collection.id}>
                  {collection.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="catalog-tag">{t("consumer.catalog.tagLabel")}</Label>
          <Select value={tagId} onValueChange={setTagId}>
            <SelectTrigger id="catalog-tag" aria-label={t("consumer.catalog.tagLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TAGS}>{t("consumer.catalog.allTags")}</SelectItem>
              {(tags.data?.tags ?? []).map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <AsyncBoundary loading={items.loading} error={items.error}>
        <CatalogList items={visibleItems} collectionNames={collectionNames} />
      </AsyncBoundary>
    </div>
  );
}

function CatalogList({
  items,
  collectionNames,
}: {
  readonly items: ReadonlyArray<KnowledgeItemView>;
  readonly collectionNames: ReadonlyMap<string, string>;
}): JSX.Element {
  const { t } = useTranslation();
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t("consumer.catalog.noItems")}
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const badge = statusBadge(item.status);
        const collectionName = collectionNames.get(item.collectionId) ?? item.collectionId;
        const showDeprecated = item.status === "deprecated" || item.isStale;
        return (
          <li key={item.id}>
            <Card>
              <CardContent className="space-y-2 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/catalog/${item.id}`} className="font-medium hover:underline">
                    {item.title}
                  </Link>
                  <Badge variant={badge.variant}>{t("common.status." + item.status)}</Badge>
                  {showDeprecated ? (
                    <Badge variant="warning">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {t("consumer.catalog.deprecated")}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {collectionName} · {t("common.sensitivity." + item.sensitivity)} · v
                  {item.publishedVersionNumber ?? item.currentVersionNumber}
                </p>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
