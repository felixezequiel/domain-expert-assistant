import { ApiError } from "./ApiError.ts";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  readonly method?: HttpMethod;
  readonly body?: unknown;
  readonly query?: Record<string, string | number | null | undefined>;
}

// Same-origin session cookie (httpOnly) carries auth; we never read/write tokens
// in JS (ADR-023). credentials:"include" sends the cookie automatically.
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query);
  const init: RequestInit = {
    method: options.method ?? "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  };

  if (options.body !== undefined) {
    init.headers = { ...init.headers, "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, init);
  const payload = await readPayload(response);

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(payload, response.status));
  }

  return payload as T;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  if (query === undefined) {
    return path;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== "") {
      params.append(key, String(value));
    }
  }
  const queryString = params.toString();
  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function extractMessage(payload: unknown, status: number): string {
  if (payload !== null && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error: unknown }).error;
    if (typeof error === "string" && error.length > 0) {
      return error;
    }
  }
  return `Request failed with status ${status}`;
}

function get<T>(path: string, query?: RequestOptions["query"]): Promise<T> {
  if (query === undefined) {
    return request<T>(path);
  }
  return request<T>(path, { query });
}

function post<T>(path: string, body?: unknown): Promise<T> {
  if (body === undefined) {
    return request<T>(path, { method: "POST" });
  }
  return request<T>(path, { method: "POST", body });
}

function put<T>(path: string, body?: unknown): Promise<T> {
  if (body === undefined) {
    return request<T>(path, { method: "PUT" });
  }
  return request<T>(path, { method: "PUT", body });
}

function deleteResource<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

export const apiClient = {
  get,
  post,
  put,
  delete: deleteResource,
};
