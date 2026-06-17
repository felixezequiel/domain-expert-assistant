import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      toast.success(t("knowledge.versions.rolledBack", { n: versionNumber }));
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
    tableBody = <TableEmptyRow columns={COLUMN_COUNT}>{t("knowledge.versions.empty")}</TableEmptyRow>;
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
            {t("knowledge.versions.rollbackThis")}
          </Button>
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t("knowledge.versions.breadcrumbItems"), to: "/items" },
          ...(itemId !== undefined ? [{ label: t("knowledge.versions.breadcrumbItem"), to: `/items/${itemId}` }] : []),
          { label: t("knowledge.versions.breadcrumbHistory") },
        ]}
      />
      <h1 className="text-2xl font-semibold tracking-tight">{t("knowledge.versions.title")}</h1>

      {error !== null ? <ErrorNotice error={error} /> : null}
      {state.error !== null ? <ErrorNotice error={state.error} /> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("knowledge.versions.columns.version")}</TableHead>
                <TableHead>{t("knowledge.versions.columns.title")}</TableHead>
                <TableHead>{t("knowledge.versions.columns.author")}</TableHead>
                <TableHead>{t("knowledge.versions.columns.created")}</TableHead>
                <TableHead className="text-right">{t("knowledge.versions.columns.action")}</TableHead>
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
              {t("knowledge.versions.compareTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={leftNumber === null ? "" : String(leftNumber)}
                onValueChange={(value) => setLeftNumber(Number(value))}
              >
                <SelectTrigger className="w-36" aria-label={t("knowledge.versions.leftVersion")}>
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
              <span className="text-sm text-muted-foreground">{t("knowledge.versions.versus")}</span>
              <Select
                value={rightNumber === null ? "" : String(rightNumber)}
                onValueChange={(value) => setRightNumber(Number(value))}
              >
                <SelectTrigger className="w-36" aria-label={t("knowledge.versions.rightVersion")}>
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
            <DialogTitle>{t("knowledge.versions.rollbackDialog.title", { n: pendingRollback })}</DialogTitle>
            <DialogDescription>{t("knowledge.versions.rollbackDialog.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingRollback(null)} disabled={rollingBack}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="button" onClick={() => void confirmRollback()} disabled={rollingBack}>
              {t("common.actions.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
