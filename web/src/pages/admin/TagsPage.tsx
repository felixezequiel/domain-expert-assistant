import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { tagsApi } from "../../api/resources.ts";
import type { TagView } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary } from "../../components/AsyncBoundary.tsx";
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

function removeDescription(target: TagView | null): string | null {
  if (target === null) {
    return null;
  }
  return `"${target.label}" will be removed. Tags that are in use cannot be removed.`;
}

function scopeBadgeVariant(scope: string): "secondary" | "outline" {
  if (scope === "system") {
    return "secondary";
  }
  return "outline";
}

export function TagsPage(): JSX.Element {
  const state = useAsync(() => tagsApi.list(), []);
  const [label, setLabel] = useState("");
  const [removeTarget, setRemoveTarget] = useState<TagView | null>(null);

  const create = async (): Promise<void> => {
    try {
      await tagsApi.create(label);
      setLabel("");
      toast.success("Tag created");
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
      toast.success("Tag removed");
      state.reload();
    } catch (caught) {
      setRemoveTarget(null);
      toast.error(errorMessage(caught));
    }
  };

  const tags = state.data?.tags ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Tenant tags</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create tag</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tag-label">Label</Label>
            <Input id="tag-label" value={label} onChange={(event) => setLabel(event.target.value)} />
          </div>
          <Button type="button" onClick={() => void create()} disabled={label === ""}>
            <Plus className="mr-2 h-4 w-4" />
            Create
          </Button>
        </CardContent>
      </Card>

      <AsyncBoundary loading={state.loading} error={state.error}>
        <TagsTable tags={tags} onRemove={setRemoveTarget} />
      </AsyncBoundary>

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
            <DialogTitle>Remove this tag?</DialogTitle>
            <DialogDescription>{removeDescription(removeTarget)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmRemove()}>
              Remove
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
  if (tag.scope === "system") {
    return <span className="text-sm text-muted-foreground">system</span>;
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => onRemove(tag)}>
      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
      Remove
    </Button>
  );
}

function TagsTable({
  tags,
  onRemove,
}: {
  readonly tags: ReadonlyArray<TagView>;
  onRemove(tag: TagView): void;
}): JSX.Element {
  if (tags.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No tags yet.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Label</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {tags.map((tag) => (
          <TableRow key={tag.id}>
            <TableCell className="font-medium">{tag.label}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{tag.slug}</TableCell>
            <TableCell>
              <Badge variant={scopeBadgeVariant(tag.scope)}>{tag.scope}</Badge>
            </TableCell>
            <TableCell>
              <TagAction tag={tag} onRemove={onRemove} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
