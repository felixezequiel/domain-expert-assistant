import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { History, RotateCcw } from "lucide-react";
import { itemsApi } from "../../api/resources.ts";
import type { KnowledgeVersionView } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { ErrorNotice } from "../../components/AsyncBoundary.tsx";
import { TableEmptyRow, TableSkeletonRows } from "../../components/TableState.tsx";
import { Breadcrumbs } from "../../components/Breadcrumbs.tsx";
import { VersionDiff } from "../../components/VersionDiff.tsx";
import { formatDateTime } from "../../lib/format.ts";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx";
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
import { toast } from "../../components/ui/sonner.tsx";

// Version history: list every version, pick two to diff, and roll back to an older one.
// Rollback creates a new version from the chosen one (the backend appends, never rewrites).
export function VersionHistoryPage(): JSX.Element {
  const { itemId } = useParams<{ itemId: string }>();
  const state = useAsync(
    () => (itemId === undefined ? Promise.resolve({ versions: [] }) : itemsApi.versions(itemId)),
    [itemId],
  );

  const [leftNumber, setLeftNumber] = useState<number | null>(null);
  const [rightNumber, setRightNumber] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [pendingRollback, setPendingRollback] = useState<number | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  const versions = state.data?.versions ?? [];

  useEffect(() => {
    if (versions.length >= 2) {
      setLeftNumber(versions[versions.length - 2]!.versionNumber);
      setRightNumber(versions[versions.length - 1]!.versionNumber);
    } else if (versions.length === 1) {
      setLeftNumber(versions[0]!.versionNumber);
      setRightNumber(versions[0]!.versionNumber);
    }
  }, [state.data]);

  const find = (versionNumber: number | null): KnowledgeVersionView | undefined =>
    versions.find((version) => version.versionNumber === versionNumber);

  const confirmRollback = async (): Promise<void> => {
    if (itemId === undefined || pendingRollback === null) {
      return;
    }
    const versionNumber = pendingRollback;
    setError(null);
    setRollingBack(true);
    try {
      await itemsApi.rollback(itemId, versionNumber);
      toast.success(`Rolled back to version ${versionNumber}`);
      setPendingRollback(null);
      state.reload();
    } catch (caught) {
      setError(caught);
    } finally {
      setRollingBack(false);
    }
  };

  const left = find(leftNumber);
  const right = find(rightNumber);

  const COLUMN_COUNT = 5;
  let tableBody: ReactNode;
  if (state.loading) {
    tableBody = <TableSkeletonRows columns={COLUMN_COUNT} />;
  } else if (versions.length === 0) {
    tableBody = <TableEmptyRow columns={COLUMN_COUNT}>No versions yet.</TableEmptyRow>;
  } else {
    tableBody = versions.map((version) => (
      <TableRow key={version.versionNumber}>
        <TableCell className="font-medium">v{version.versionNumber}</TableCell>
        <TableCell>{version.title}</TableCell>
        <TableCell>{version.createdByName ?? version.createdBy}</TableCell>
        <TableCell>{formatDateTime(version.createdAt)}</TableCell>
        <TableCell className="text-right">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPendingRollback(version.versionNumber)}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Roll back to this
          </Button>
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Items", to: "/items" },
          ...(itemId !== undefined ? [{ label: "Item", to: `/items/${itemId}` }] : []),
          { label: "Version history" },
        ]}
      />
      <h1 className="text-2xl font-semibold tracking-tight">Version history</h1>

      {error !== null ? <ErrorNotice error={error} /> : null}
      {state.error !== null ? <ErrorNotice error={state.error} /> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{tableBody}</TableBody>
          </Table>
        </CardContent>
      </Card>

      {versions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-muted-foreground" />
              Compare versions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={leftNumber === null ? "" : String(leftNumber)}
                onValueChange={(value) => setLeftNumber(Number(value))}
              >
                <SelectTrigger className="w-36" aria-label="Left version">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((version) => (
                    <SelectItem key={version.versionNumber} value={String(version.versionNumber)}>
                      v{version.versionNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">vs</span>
              <Select
                value={rightNumber === null ? "" : String(rightNumber)}
                onValueChange={(value) => setRightNumber(Number(value))}
              >
                <SelectTrigger className="w-36" aria-label="Right version">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((version) => (
                    <SelectItem key={version.versionNumber} value={String(version.versionNumber)}>
                      v{version.versionNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {left !== undefined && right !== undefined ? (
              <VersionDiff
                oldText={left.body}
                newText={right.body}
                oldLabel={`v${left.versionNumber}`}
                newLabel={`v${right.versionNumber}`}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={pendingRollback !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRollback(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Roll back to version {pendingRollback}?</DialogTitle>
            <DialogDescription>
              Rolling back creates a new version and returns the item to draft (it must be
              re-submitted for review).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingRollback(null)} disabled={rollingBack}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void confirmRollback()} disabled={rollingBack}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
