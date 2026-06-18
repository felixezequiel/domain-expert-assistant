import { useState, type ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { itemsApi, tagsApi } from "../../api/resources.ts";
import type { TagView } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { ErrorNotice } from "../../components/AsyncBoundary.tsx";
import { TableEmptyRow, TableSkeletonRows } from "../../components/TableState.tsx";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import { Input } from "../../components/ui/input.tsx";
import { Label } from "../../components/ui/label.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx";
import { toast } from "../../components/ui/sonner.tsx";

function errorMessage(caught: unknown): string {
  if (caught instanceof Error) {
    return caught.message;
  }
  return "Something went wrong.";
}

function removeDescription(target: TagView | null, t: TFunction): string | null {
  if (target === null) {
    return null;
  }
  return t("admin.tags.removeDescription", { label: target.label });
}

function scopeBadgeVariant(scope: string): "secondary" | "outline" {
  if (scope === "system") {
    return "secondary";
  }
  return "outline";
}

export function TagsPage(): JSX.Element {
  const { t } = useTranslation();
  const state = useAsync(() => tagsApi.list(), []);
  // Item counts surface which tags are actually applied (derived client-side).
  const items = useAsync(() => itemsApi.list(), []);
  const [label, setLabel] = useState("");
  const [removeTarget, setRemoveTarget] = useState<TagView | null>(null);

  const create = async (): Promise<void> => {
    try {
      await tagsApi.create(label);
      setLabel("");
      toast.success(t("admin.tags.toasts.created"));
      state.reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const confirmRemove = async (): Promise<void> => {
    if (removeTarget === null) {
      return;
    }
    try {
      await tagsApi.remove(removeTarget.id);
      setRemoveTarget(null);
      toast.success(t("admin.tags.toasts.removed"));
      state.reload();
    } catch (caught) {
      setRemoveTarget(null);
      toast.error(errorMessage(caught));
    }
  };

  const tags = state.data?.tags ?? [];
  const itemCountFor = (tagId: string): number =>
    (items.data?.items ?? []).filter((item) => item.tagIds.includes(tagId)).length;

  const COLUMN_COUNT = 5;
  let tableBody: ReactNode;
  if (state.loading) {
    tableBody = <TableSkeletonRows columns={COLUMN_COUNT} />;
  } else if (tags.length === 0) {
    tableBody = <TableEmptyRow columns={COLUMN_COUNT}>{t("admin.tags.empty")}</TableEmptyRow>;
  } else {
    tableBody = tags.map((tag) => (
      <TableRow key={tag.id}>
        <TableCell className="font-medium">{tag.label}</TableCell>
        <TableCell className="font-mono text-xs text-muted-foreground">{tag.slug}</TableCell>
        <TableCell>
          <Badge variant={scopeBadgeVariant(tag.scope)}>{t("admin.tags.scope." + tag.scope)}</Badge>
        </TableCell>
        <TableCell className="tabular-nums text-muted-foreground">{itemCountFor(tag.id)}</TableCell>
        <TableCell>
          <TagAction tag={tag} onRemove={setRemoveTarget} />
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.tags.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.tags.createCard")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tag-label">{t("admin.tags.labelLabel")}</Label>
            <Input id="tag-label" value={label} onChange={(event) => setLabel(event.target.value)} />
          </div>
          <Button type="button" onClick={() => void create()} disabled={label === ""}>
            <Plus className="mr-2 h-4 w-4" />
            {t("common.actions.create")}
          </Button>
        </CardContent>
      </Card>

      {state.error !== null ? <ErrorNotice error={state.error} /> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.tags.columns.label")}</TableHead>
                <TableHead>{t("admin.tags.columns.slug")}</TableHead>
                <TableHead>{t("admin.tags.columns.scope")}</TableHead>
                <TableHead>{t("admin.tags.columns.items")}</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>{tableBody}</TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(next) => {
          if (!next) {
            setRemoveTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.tags.removeTitle")}</DialogTitle>
            <DialogDescription>{removeDescription(removeTarget, t)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmRemove()}>
              {t("common.actions.remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TagAction({
  tag,
  onRemove,
}: {
  readonly tag: TagView;
  onRemove(tag: TagView): void;
}): JSX.Element {
  const { t } = useTranslation();
  if (tag.scope === "system") {
    return <span className="text-sm text-muted-foreground">{t("admin.tags.scope.system")}</span>;
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => onRemove(tag)}>
      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
      {t("common.actions.remove")}
    </Button>
  );
}
