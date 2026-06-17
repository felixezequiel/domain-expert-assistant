import type { AuditTrailFilter } from "../types.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

export const DEFAULT_AUDIT_LIMIT = 100;
export const MAX_AUDIT_LIMIT = 1000;

export interface ListAuditTrailOptions {
  readonly aggregateId?: string;
  readonly actorId?: string;
  readonly eventName?: string;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
}

export class ListAuditTrailQuery {
  public readonly filter: AuditTrailFilter;

  private constructor(filter: AuditTrailFilter) {
    this.filter = filter;
  }

  public static of(options: ListAuditTrailOptions = {}): ListAuditTrailQuery {
    return new ListAuditTrailQuery({
      aggregateId: options.aggregateId ?? null,
      actorId: options.actorId ?? null,
      eventName: options.eventName ?? null,
      from: ListAuditTrailQuery.parseDate(options.from),
      to: ListAuditTrailQuery.parseDate(options.to),
      limit: ListAuditTrailQuery.normalizeLimit(options.limit),
    });
  }

  private static normalizeLimit(limit: number | undefined): number {
    if (limit === undefined || limit < 1) {
      return DEFAULT_AUDIT_LIMIT;
    }
    if (limit > MAX_AUDIT_LIMIT) {
      return MAX_AUDIT_LIMIT;
    }
    return Math.floor(limit);
  }

  private static parseDate(value: string | undefined): Date | null {
    if (value === undefined) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new DomainError(
        "audit.invalidDate",
        "validation",
        { value },
        "Invalid date in audit trail query: " + value,
      );
    }
    return date;
  }
}
