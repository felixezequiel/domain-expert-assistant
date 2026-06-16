// Thrown by the apiClient on any non-2xx response so screens can branch on status:
// 401 -> redirect to login, 403 -> "not permitted", 400 -> validation message.
export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
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
