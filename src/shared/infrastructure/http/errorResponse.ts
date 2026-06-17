import { DomainError, type ErrorKind } from "../../domain/errors/DomainError.ts";

// Maps a domain error's semantic kind to an HTTP status, so the edge no longer guesses the
// status from substrings of the message (the old fragile `statusForError`). Every module's
// edge serializes errors through `toErrorResponse`, returning the stable code + an English
// fallback message (+ params) so the SPA can translate the code.

const STATUS_BY_KIND: Record<ErrorKind, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unavailable: 503,
  internal: 500,
};

const HTTP_INTERNAL_ERROR = 500;

export function httpStatusForKind(kind: ErrorKind): number {
  return STATUS_BY_KIND[kind];
}

export interface ErrorResponse {
  readonly statusCode: number;
  readonly body: {
    readonly error: string;
    readonly message: string;
    readonly params?: Readonly<Record<string, string | number>>;
  };
}

export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof DomainError) {
    return {
      statusCode: httpStatusForKind(error.kind),
      body:
        error.params === undefined
          ? { error: error.code, message: error.message }
          : { error: error.code, message: error.message, params: error.params },
    };
  }
  const message = error instanceof Error ? error.message : "Internal Server Error";
  return { statusCode: HTTP_INTERNAL_ERROR, body: { error: "common.unexpected", message } };
}
