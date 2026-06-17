import { type ReactNode } from "react";
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
  const state = useAsync(() => itemsApi.list(undefined, "in_review"), []);
  const items = state.data?.items ?? [];

  const COLUMN_COUNT = 4;
  let tableBody: ReactNode;
  if (state.loading) {
    tableBody = <TableSkeletonRows columns={COLUMN_COUNT} />;
  } else if (items.length === 0) {
    tableBody = <TableEmptyRow columns={COLUMN_COUNT}>Nothing waiting for review.</TableEmptyRow>;
  } else {
    tableBody = items.map((item) => (
      <TableRow key={item.id}>
        <TableCell className="font-medium">{item.title}</TableCell>
        <TableCell>{item.sensitivity}</TableCell>
        <TableCell>v{item.currentVersionNumber}</TableCell>
        <TableCell className="text-right">
          <Button asChild size="sm" variant="secondary">
            <Link to={`/review/${item.id}`}>Review</Link>
          </Button>
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>

      {state.error !== null ? <ErrorNotice error={state.error} /> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Sensitivity</TableHead>
                <TableHead>Version</TableHead>
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
