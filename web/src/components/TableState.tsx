import type { ReactNode } from "react";
import { Skeleton } from "./ui/skeleton.tsx";
import { TableCell, TableRow } from "./ui/table.tsx";

const DEFAULT_SKELETON_ROWS = 5;

// Placeholder rows shown inside a <TableBody> while data loads — keeps the table's shape
// (header + row rhythm) stable instead of collapsing to a spinner.
export function TableSkeletonRows({
  columns,
  rows = DEFAULT_SKELETON_ROWS,
}: {
  readonly columns: number;
  readonly rows?: number;
}): JSX.Element {
  return (
    <>
      {Array.from({ length: rows }, (_unusedRow, rowIndex) => (
        <TableRow key={rowIndex} className="hover:bg-transparent">
          {Array.from({ length: columns }, (_unusedCol, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton className="h-4 w-full max-w-[9rem]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// A single full-width row for the "nothing here yet" state of a table.
export function TableEmptyRow({
  columns,
  children,
}: {
  readonly columns: number;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={columns} className="py-10 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}
