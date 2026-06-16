/**
 * Authorization vocabulary shared across bounded contexts (ADR-011). Roles are
 * additive (a User may hold several). Lives in the shared kernel so any context can
 * declare a required role (e.g. a Knowledge use case requiring `curator`) without
 * importing the Identity context — Identity owns role *assignment*, not the vocabulary.
 */
export const ROLES = ["admin", "curator", "reviewer", "auditor", "consumer"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as ReadonlyArray<string>).includes(value);
}

export function parseRole(value: string): Role {
  if (!isRole(value)) {
    throw new Error("Unknown role: " + value);
  }
  return value;
}
