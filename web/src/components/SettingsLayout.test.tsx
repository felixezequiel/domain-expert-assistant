import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SettingsLayout } from "./SettingsLayout.tsx";

describe("SettingsLayout", () => {
  it("renders the settings sub-tabs and the active child", () => {
    render(
      <MemoryRouter initialEntries={["/settings/members"]}>
        <Routes>
          <Route path="/settings" element={<SettingsLayout />}>
            <Route path="members" element={<div>members content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Members" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "API credentials" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Policy" })).toBeInTheDocument();
    expect(screen.getByText("members content")).toBeInTheDocument();
  });
});
