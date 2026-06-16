import { vi } from "vitest";

// Shared test helpers (exempt from the co-located-test gate as an index.ts module).

export interface MockResponseSpec {
  readonly status?: number;
  readonly body?: unknown;
}

// Builds a fetch stub that returns queued responses in order. Each call shifts the next
// spec; once only one remains it is reused for every subsequent call. Lets tests drive the
// apiClient/screens without a real server.
export function mockFetchSequence(specs: ReadonlyArray<MockResponseSpec>): ReturnType<typeof vi.fn> {
  const queue = [...specs];
  return vi.fn(async () => {
    let spec: MockResponseSpec;
    if (queue.length > 1) {
      spec = queue.shift()!;
    } else {
      spec = queue[0] ?? { status: 200, body: {} };
    }
    const status = spec.status ?? 200;
    const text = spec.body === undefined ? "" : JSON.stringify(spec.body);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    } as Response;
  });
}

export function installFetch(fn: ReturnType<typeof vi.fn>): void {
  globalThis.fetch = fn as unknown as typeof fetch;
}
