import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAsync } from "./useAsync.ts";

describe("useAsync", () => {
  it("loads data and clears the loading flag", async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve("value"), []));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("value");
    expect(result.current.error).toBeNull();
  });

  it("captures a rejection as error", async () => {
    const { result } = renderHook(() => useAsync(() => Promise.reject(new Error("nope")), []));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.data).toBeNull();
  });

  it("re-runs the loader on reload", async () => {
    const loader = vi.fn(async () => "x");
    const { result } = renderHook(() => useAsync(loader, []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loader).toHaveBeenCalledTimes(1);
    act(() => result.current.reload());
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
  });
});
