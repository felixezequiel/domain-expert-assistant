import { useState, type ReactNode } from "react";
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
      toast.success("Collection created");
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
      toast.success("Collection renamed");
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
    tableBody = <TableEmptyRow columns={COLUMN_COUNT}>No collections yet.</TableEmptyRow>;
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
            Rename
          </Button>
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create collection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="coll-name">Name</Label>
            <Input id="coll-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coll-desc">Description (optional)</Label>
            <Input
              id="coll-desc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <Button type="button" onClick={() => void create()} disabled={name === ""}>
            <Plus className="mr-2 h-4 w-4" />
            Create
          </Button>
        </CardContent>
      </Card>

      {state.error !== null ? <ErrorNotice error={state.error} /> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Id</TableHead>
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
            <DialogTitle>Rename collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="coll-rename">Name</Label>
            <Input
              id="coll-rename"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void rename()} disabled={renameValue === ""}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
