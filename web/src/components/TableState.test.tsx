import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Table, TableBody } from "./ui/table.tsx";
import { TableSkeletonRows, TableEmptyRow } from "./TableState.tsx";

describe("TableSkeletonRows", () => {
  it("renders rows × columns of placeholder cells", () => {
    render(
      <Table>
        <TableBody>
          <TableSkeletonRows columns={3} rows={4} />
        </TableBody>
      </Table>,
    );
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getAllByRole("cell")).toHaveLength(12);
  });
});

describe("TableEmptyRow", () => {
  it("spans every column with the empty message", () => {
    render(
      <Table>
        <TableBody>
          <TableEmptyRow columns={3}>Nothing here yet.</TableEmptyRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("cell")).toHaveAttribute("colspan", "3");
  });
});
