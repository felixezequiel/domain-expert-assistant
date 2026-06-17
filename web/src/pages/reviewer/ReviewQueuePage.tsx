import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { itemsApi } from "../../api/resources.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { ErrorNotice } from "../../components/AsyncBoundary.tsx";
import { TableEmptyRow, TableSkeletonRows } from "../../components/TableState.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent } from "../../components/ui/card.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table.tsx";

// Reviewer queue: items currently in_review, filtered server-side by status.
export function ReviewQueuePage(): JSX.Element {
  const { t } = useTranslation();
  const state = useAsync(() => itemsApi.list(undefined, "in_review"), []);
  const items = state.data?.items ?? [];

  const COLUMN_COUNT = 4;
  let tableBody: ReactNode;
  if (state.loading) {
    tableBody = <TableSkeletonRows columns={COLUMN_COUNT} />;
  } else if (items.length === 0) {
    tableBody = <TableEmptyRow columns={COLUMN_COUNT}>{t("review.queue.empty")}</TableEmptyRow>;
  } else {
    tableBody = items.map((item) => (
      <TableRow key={item.id}>
        <TableCell className="font-medium">{item.title}</TableCell>
        <TableCell>{t("common.sensitivity." + item.sensitivity)}</TableCell>
        <TableCell>{t("review.version", { number: item.currentVersionNumber })}</TableCell>
        <TableCell className="text-right">
          <Button asChild size="sm" variant="secondary">
            <Link to={`/review/${item.id}`}>{t("review.queue.review")}</Link>
          </Button>
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("review.queue.title")}</h1>

      {state.error !== null ? <ErrorNotice error={state.error} /> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("review.queue.columns.title")}</TableHead>
                <TableHead>{t("review.queue.columns.sensitivity")}</TableHead>
                <TableHead>{t("review.queue.columns.version")}</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>{tableBody}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
