import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AsyncBoundary, ErrorNotice } from "./AsyncBoundary.tsx";
import { ApiError } from "../api/ApiError.ts";

describe("AsyncBoundary", () => {
  it("shows a loading notice while loading", () => {
    render(
      <AsyncBoundary loading error={null}>
        <div>content</div>
      </AsyncBoundary>,
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("content")).toBeNull();
  });

  it("renders children once loaded with no error", () => {
    render(
      <AsyncBoundary loading={false} error={null}>
        <div>content</div>
      </AsyncBoundary>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("renders the error notice when an error is present", () => {
    render(
      <AsyncBoundary loading={false} error={new ApiError(400, "bad input")}>
        <div>content</div>
      </AsyncBoundary>,
    );
    expect(screen.getByText("bad input")).toBeInTheDocument();
  });
});

describe("ErrorNotice", () => {
  it("renders a 'not permitted' message for 403", () => {
    render(<ErrorNotice error={new ApiError(403, "Forbidden")} />);
    expect(screen.getByText(/not permitted/i)).toBeInTheDocument();
  });

  it("renders a session-expired message for 401", () => {
    render(<ErrorNotice error={new ApiError(401, "Unauthorized")} />);
    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it("renders a generic message for non-ApiError", () => {
    render(<ErrorNotice error={new Error("boom")} />);
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});
