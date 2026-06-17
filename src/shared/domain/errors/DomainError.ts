/**
 * A domain/application error that carries a STABLE machine code (a translation key, e.g.
 * "knowledge.collectionNameExists") plus a semantic `kind` the HTTP edge maps to a status,
 * and optional `params` for the UI to interpolate (e.g. { id }). The `message` is an English
 * fallback for logs and non-i18n clients; the SPA translates `code` and only falls back to
 * `message` when it has no translation. Replaces throwing bare `Error("english prose")`.
 */
export type ErrorKind =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "unavailable"
  | "internal";

export class DomainError extends Error {
  public readonly code: string;
  public readonly kind: ErrorKind;
  public readonly params: Readonly<Record<string, string | number>> | undefined;

  constructor(code: string, kind: ErrorKind, params?: Record<string, string | number>, message?: string) {
    super(message ?? code);
    this.name = "DomainError";
    this.code = code;
    this.kind = kind;
    this.params = params;
  }
}
