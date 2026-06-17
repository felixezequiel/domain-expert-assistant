/**
 * Authorization vocabulary shared across bounded contexts (ADR-011). Roles are
 * additive (a User may hold several). Lives in the shared kernel so any context can
 * declare a required role (e.g. a Knowledge use case requiring `curator`) without
 * importing the Identity context — Identity owns role *assignment*, not the vocabulary.
 */
import { DomainError } from "./errors/DomainError.ts";

export const ROLES = ["admin", "curator", "reviewer", "auditor", "consumer"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as ReadonlyArray<string>).includes(value);
}

export function parseRole(value: string): Role {
  if (!isRole(value)) {
    // kind "internal" preserves the pre-ADR-026 status: this message matched no edge's
    // substring `statusForError`, so it became a 500. Semantically this is a user-facing
    // validation failure (400) — flagged for the main agent (ADR-026 §3 keep-status rule).
    throw new DomainError("common.unknownRole", "internal", { value }, "Unknown role: " + value);
  }
  return value;
}
