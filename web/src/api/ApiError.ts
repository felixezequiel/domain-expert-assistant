// Thrown by the apiClient on any non-2xx response so screens can branch on status:
// 401 -> redirect to login, 403 -> "not permitted", 400 -> validation message.
// `code` is the backend's stable error key (ADR-026) — the SPA translates it (t("errors."+code),
// with the English `message` as the fallback when there's no translation yet). `code`/`params`
// are undefined for legacy responses that only sent an English `error`.
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string | undefined;
  public readonly params: Readonly<Record<string, string | number>> | undefined;

  constructor(
    status: number,
    message: string,
    code?: string,
    params?: Record<string, string | number>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.params = params;
  }

  public get isUnauthorized(): boolean {
    return this.status === 401;
  }

  public get isForbidden(): boolean {
    return this.status === 403;
  }

  public get isBadRequest(): boolean {
    return this.status === 400;
  }
}
