import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Plus } from "lucide-react";
import { collectionsApi, itemsApi, tagsApi } from "../../api/resources.ts";
import { LIFECYCLE_STATUSES, SENSITIVITY_LEVELS, type KnowledgeItemView } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { ErrorNotice } from "../../components/AsyncBoundary.tsx";
import { TableEmptyRow, TableSkeletonRows } from "../../components/TableState.tsx";
import { statusBadge } from "../../lib/format.ts";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent } from "../../components/ui/card.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table.tsx";

// A shadcn Select needs a non-empty value per item, so "all" stands in for "no filter"
// and is mapped back to undefined before it ever reaches the API.
const ALL = "all";

// Curator item list with filters (collection, tag, status, sensitivity). Backend filters
// by collection + status server-side; tag + sensitivity are filtered client-side over the
// returned set (the list endpoint only accepts collectionId + status query params).
export function ItemsListPage(): JSX.Element {
  const { t } = useTranslation();
  const collections = useAsync(() => collectionsApi.list(), []);
  const tags = useAsync(() => tagsApi.list(), []);

  const [collectionId, setCollectionId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [tagId, setTagId] = useState(ALL);
  const [sensitivity, setSensitivity] = useState(ALL);

  const items = useAsync(
    () =>
      itemsApi.list(
        collectionId === ALL ? undefined : collectionId,
        status === ALL ? undefined : status,
      ),
    [collectionId, status],
  );

  // Drafts that came back from review with a rejection reason are the "needs attention" set
  // (mirrors the dashboard). Fetched independently of the table filters so the callout stays
  // visible even when the table is filtered to another status — that intent must not get lost.
  const attention = useAsync(() => itemsApi.list(undefined, "draft"), []);
  const rejectedDrafts = (attention.data?.items ?? []).filter(
    (item) => item.lastRejectionReason !== null,
  );

  const visibleItems = (items.data?.items ?? []).filter((item) => {
    const tagMatches = tagId === ALL || item.tagIds.includes(tagId);
    const sensitivityMatches = sensitivity === ALL || item.sensitivity === sensitivity;
    return tagMatches && sensitivityMatches;
  });

  const COLUMN_COUNT = 5;
  let tableBody: ReactNode;
  if (items.loading) {
    tableBody = <TableSkeletonRows columns={COLUMN_COUNT} />;
  } else if (visibleItems.length === 0) {
    tableBody = <TableEmptyRow columns={COLUMN_COUNT}>{t("knowledge.list.empty")}</TableEmptyRow>;
  } else {
    tableBody = visibleItems.map((item: KnowledgeItemView) => <ItemRow key={item.id} item={item} />);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("knowledge.list.title")}</h1>
        <Button asChild>
          <Link to="/items/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("knowledge.list.newItem")}
          </Link>
        </Button>
      </div>

      {rejectedDrafts.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {t("knowledge.list.attention.heading")}
          </h2>
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="divide-y divide-border p-0">
              {rejectedDrafts.map((item) => (
                <Link
                  key={item.id}
                  to={`/items/${item.id}`}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-warning/10"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {t("knowledge.list.attention.rejected", { reason: item.lastRejectionReason })}
                    </p>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap gap-3 py-4">
          <Select value={collectionId} onValueChange={setCollectionId}>
            <SelectTrigger className="w-48" aria-label={t("knowledge.list.filters.collection")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("knowledge.list.filters.allCollections")}</SelectItem>
              {(collections.data?.collections ?? []).map((collection) => (
                <SelectItem key={collection.id} value={collection.id}>
                  {collection.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44" aria-label={t("knowledge.list.filters.status")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("knowledge.list.filters.allStatuses")}</SelectItem>
              {LIFECYCLE_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t("common.status." + value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tagId} onValueChange={setTagId}>
            <SelectTrigger className="w-44" aria-label={t("knowledge.list.filters.tag")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("knowledge.list.filters.allTags")}</SelectItem>
              {(tags.data?.tags ?? []).map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sensitivity} onValueChange={setSensitivity}>
            <SelectTrigger className="w-44" aria-label={t("knowledge.list.filters.sensitivity")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("knowledge.list.filters.allSensitivities")}</SelectItem>
              {SENSITIVITY_LEVELS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t("common.sensitivity." + value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {items.error !== null ? <ErrorNotice error={items.error} /> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("knowledge.list.columns.title")}</TableHead>
                <TableHead>{t("knowledge.list.columns.status")}</TableHead>
                <TableHead>{t("knowledge.list.columns.sensitivity")}</TableHead>
                <TableHead>{t("knowledge.list.columns.version")}</TableHead>
                <TableHead className="text-right">{t("knowledge.list.columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{tableBody}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ItemRow({ item }: { readonly item: KnowledgeItemView }): JSX.Element {
  const { t } = useTranslation();
  const badge = statusBadge(item.status);
  return (
    <TableRow>
      <TableCell className="font-medium">{item.title}</TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <Badge variant={badge.variant}>{t("common.status." + item.status)}</Badge>
          {item.isStale ? <Badge variant="warning">{t("knowledge.list.stale")}</Badge> : null}
        </span>
      </TableCell>
      <TableCell>{t("common.sensitivity." + item.sensitivity)}</TableCell>
      <TableCell>{item.currentVersionNumber}</TableCell>
      <TableCell className="text-right">
        <span className="flex justify-end gap-3 text-sm">
          <Link className="text-primary hover:underline" to={`/items/${item.id}`}>
            {t("common.actions.edit")}
          </Link>
          <Link className="text-primary hover:underline" to={`/items/${item.id}/versions`}>
            {t("knowledge.list.rowActions.versions")}
          </Link>
        </span>
      </TableCell>
    </TableRow>
  );
}
