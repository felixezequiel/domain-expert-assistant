import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Plus } from "lucide-react";
import { collectionsApi } from "../../api/resources.ts";
import type { CollectionView } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { ErrorNotice } from "../../components/AsyncBoundary.tsx";
import { TableEmptyRow, TableSkeletonRows } from "../../components/TableState.tsx";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx";
import { toast } from "../../components/ui/sonner.tsx";

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Something went wrong.";
}

interface RenameTarget {
  readonly id: string;
  readonly name: string;
}

export function CollectionsPage(): JSX.Element {
  const { t } = useTranslation();
  const state = useAsync(() => collectionsApi.list(), []);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const create = async (): Promise<void> => {
    try {
      await collectionsApi.create(name, description === "" ? undefined : description);
      setName("");
      setDescription("");
      toast.success(t("admin.collections.toasts.created"));
      state.reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const openRename = (collection: CollectionView): void => {
    setRenameTarget({ id: collection.id, name: collection.name });
    setRenameValue(collection.name);
  };

  const rename = async (): Promise<void> => {
    if (renameTarget === null) {
      return;
    }
    try {
      await collectionsApi.rename(renameTarget.id, renameValue);
      setRenameTarget(null);
      toast.success(t("admin.collections.toasts.renamed"));
      state.reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const collections = state.data?.collections ?? [];

  const COLUMN_COUNT = 4;
  let tableBody: ReactNode;
  if (state.loading) {
    tableBody = <TableSkeletonRows columns={COLUMN_COUNT} />;
  } else if (collections.length === 0) {
    tableBody = <TableEmptyRow columns={COLUMN_COUNT}>{t("admin.collections.empty")}</TableEmptyRow>;
  } else {
    tableBody = collections.map((collection) => (
      <TableRow key={collection.id}>
        <TableCell className="font-medium">{collection.name}</TableCell>
        <TableCell>{collection.description ?? "—"}</TableCell>
        <TableCell>
          <code
            className="block max-w-[12rem] truncate font-mono text-xs text-muted-foreground"
            title={collection.id}
          >
            {collection.id}
          </code>
        </TableCell>
        <TableCell>
          <Button type="button" variant="outline" size="sm" onClick={() => openRename(collection)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {t("admin.collections.rename")}
          </Button>
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.collections.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.collections.createCard")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="coll-name">{t("admin.collections.nameLabel")}</Label>
            <Input id="coll-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coll-desc">{t("admin.collections.descriptionLabel")}</Label>
            <Input
              id="coll-desc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <Button type="button" onClick={() => void create()} disabled={name === ""}>
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
                <TableHead>{t("admin.collections.columns.name")}</TableHead>
                <TableHead>{t("admin.collections.columns.description")}</TableHead>
                <TableHead>{t("admin.collections.columns.id")}</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>{tableBody}</TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(next) => {
          if (!next) {
            setRenameTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.collections.renameTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="coll-rename">{t("admin.collections.nameLabel")}</Label>
            <Input
              id="coll-rename"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="button" onClick={() => void rename()} disabled={renameValue === ""}>
              {t("common.actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
