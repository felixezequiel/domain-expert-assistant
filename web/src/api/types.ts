// Mirrors of the backend REST view shapes (read-only on the client). These are hand-kept
// copies of the server's application/types.ts contracts — the SPA is a pure REST client
// (ADR-023) and never imports backend code.

export const ROLES = ["admin", "curator", "reviewer", "auditor", "consumer"] as const;
export type Role = (typeof ROLES)[number];

export const SENSITIVITY_LEVELS = ["public", "internal", "confidential"] as const;
export type SensitivityLevel = (typeof SENSITIVITY_LEVELS)[number];

export const LIFECYCLE_STATUSES = [
  "draft",
  "in_review",
  "published",
  "deprecated",
  "archived",
] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export interface LoginResponse {
  readonly userId: string;
  readonly companyId: string;
  readonly expiresAt: string;
}

/** GET /auth/me — restores the session on refresh and names the signed-in user. */
export interface CurrentUser {
  readonly userId: string;
  readonly companyId: string;
  readonly email: string;
  readonly displayName: string;
  readonly roles: ReadonlyArray<Role>;
  readonly status: string;
}

/** A row in the admin user roster (GET /organizations/:orgId/users). */
export interface OrgUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly roles: ReadonlyArray<string>;
  readonly status: string;
}

/** GET /organizations/:orgId/policy — the live governance policy. */
export interface OrgPolicyView {
  readonly organizationId: string;
  readonly requireSeparateReviewer: boolean;
}

export interface KnowledgeItemView {
  readonly id: string;
  readonly collectionId: string;
  readonly title: string;
  readonly body: string;
  readonly tagIds: ReadonlyArray<string>;
  readonly sensitivity: string;
  readonly status: string;
  readonly currentVersionNumber: number;
  readonly publishedVersionNumber: number | null;
  readonly isServed: boolean;
  readonly isStale: boolean;
  readonly lastRejectionReason: string | null;
}

export interface KnowledgeItemListEntry {
  readonly id: string;
  readonly status: string;
}

export interface KnowledgeVersionView {
  readonly itemId: string;
  readonly versionNumber: number;
  readonly title: string;
  readonly body: string;
  readonly tagIds: ReadonlyArray<string>;
  readonly sensitivity: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface CollectionView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdBy: string;
}

export interface TagView {
  readonly id: string;
  readonly slug: string;
  readonly label: string;
  readonly scope: string;
}

export interface ConsumerCredentialView {
  readonly id: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly collectionIds: ReadonlyArray<string>;
  readonly sensitivityCeiling: string;
  readonly status: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
}

export interface IssuedCredential {
  readonly id: string;
  readonly secret: string;
}

export interface SearchResult {
  readonly itemId: string;
  readonly title: string;
  readonly collectionId: string;
  readonly sensitivity: string;
  readonly chunkIndex: number;
  readonly content: string;
  readonly score: number;
  readonly publishedAt: string;
  readonly stale: boolean;
}

export interface IngestionJobView {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly status: string;
  readonly createdItemId: string | null;
  readonly failureReason: string | null;
}

export interface IngestionUploadAccepted {
  readonly jobId: string;
  readonly status: string;
}

export interface AuditEventView {
  readonly eventId: string;
  readonly eventName: string;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly companyId: string | null;
  readonly actorId: string | null;
  readonly actorType: string | null;
  readonly causationId: string | null;
}

export interface InvitedUser {
  readonly userId: string;
  readonly invitationToken: string;
}
