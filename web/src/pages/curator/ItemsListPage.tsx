import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
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
    tableBody = <TableEmptyRow columns={COLUMN_COUNT}>No items match these filters.</TableEmptyRow>;
  } else {
    tableBody = visibleItems.map((item: KnowledgeItemView) => <ItemRow key={item.id} item={item} />);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Items</h1>
        <Button asChild>
          <Link to="/items/new">
            <Plus className="mr-2 h-4 w-4" />
            New item
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 py-4">
          <Select value={collectionId} onValueChange={setCollectionId}>
            <SelectTrigger className="w-48" aria-label="Collection filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All collections</SelectItem>
              {(collections.data?.collections ?? []).map((collection) => (
                <SelectItem key={collection.id} value={collection.id}>
                  {collection.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44" aria-label="Status filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {LIFECYCLE_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {statusBadge(value).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tagId} onValueChange={setTagId}>
            <SelectTrigger className="w-44" aria-label="Tag filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All tags</SelectItem>
              {(tags.data?.tags ?? []).map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sensitivity} onValueChange={setSensitivity}>
            <SelectTrigger className="w-44" aria-label="Sensitivity filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sensitivities</SelectItem>
              {SENSITIVITY_LEVELS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
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
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sensitivity</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
  const badge = statusBadge(item.status);
  return (
    <TableRow>
      <TableCell className="font-medium">{item.title}</TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          {item.isStale ? <Badge variant="warning">stale</Badge> : null}
        </span>
      </TableCell>
      <TableCell>{item.sensitivity}</TableCell>
      <TableCell>{item.currentVersionNumber}</TableCell>
      <TableCell className="text-right">
        <span className="flex justify-end gap-3 text-sm">
          <Link className="text-primary hover:underline" to={`/items/${item.id}`}>
            Edit
          </Link>
          <Link className="text-primary hover:underline" to={`/items/${item.id}/versions`}>
            Versions
          </Link>
        </span>
      </TableCell>
    </TableRow>
  );
}
