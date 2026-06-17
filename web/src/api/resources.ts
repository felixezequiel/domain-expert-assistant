import { apiClient } from "./apiClient.ts";
import type {
  AuditEventView,
  CollectionView,
  ConsumerCredentialView,
  CurrentUser,
  IngestionJobView,
  IngestionUploadAccepted,
  InvitedUser,
  IssuedCredential,
  KnowledgeItemListEntry,
  KnowledgeItemView,
  KnowledgeVersionView,
  LoginResponse,
  OrgPolicyView,
  OrgUser,
  SearchResult,
  TagView,
} from "./types.ts";

// Thin, typed wrappers over each REST endpoint. One place that knows the exact
// path + payload shape per backend route (the bootstrap modules are the contract).

export const authApi = {
  login: (email: string, password: string): Promise<LoginResponse> =>
    apiClient.post<LoginResponse>("/auth/login", { email, password }),
  logout: (): Promise<unknown> => apiClient.post("/auth/logout"),
  // Restores the session on a hard refresh (the httpOnly cookie outlives the SPA's memory)
  // and names the signed-in user + roles for the UI (capabilities, nav, top bar).
  me: (): Promise<CurrentUser> => apiClient.get<CurrentUser>("/auth/me"),
  acceptInvitation: (token: string, password: string): Promise<{ userId: string; status: string }> =>
    apiClient.post(`/invitations/${encodeURIComponent(token)}/accept`, { password }),
};

export const usersApi = {
  list: (orgId: string): Promise<{ users: OrgUser[] }> =>
    apiClient.get(`/organizations/${encodeURIComponent(orgId)}/users`),
  invite: (
    orgId: string,
    email: string,
    displayName: string,
    roles: ReadonlyArray<string>,
  ): Promise<InvitedUser> =>
    apiClient.post<InvitedUser>(`/organizations/${encodeURIComponent(orgId)}/users/invite`, {
      email,
      displayName,
      roles,
    }),
  changeRoles: (userId: string, roles: ReadonlyArray<string>): Promise<{ userId: string; roles: string[] }> =>
    apiClient.put(`/users/${encodeURIComponent(userId)}/roles`, { roles }),
  disable: (userId: string): Promise<{ userId: string; status: string }> =>
    apiClient.post(`/users/${encodeURIComponent(userId)}/disable`),
  getPolicy: (orgId: string): Promise<OrgPolicyView> =>
    apiClient.get(`/organizations/${encodeURIComponent(orgId)}/policy`),
  setPolicy: (orgId: string, requireSeparateReviewer: boolean): Promise<unknown> =>
    apiClient.put(`/organizations/${encodeURIComponent(orgId)}/policy`, { requireSeparateReviewer }),
};

export const credentialsApi = {
  list: (): Promise<{ credentials: ConsumerCredentialView[] }> =>
    apiClient.get("/credentials"),
  issue: (
    name: string,
    collectionIds: ReadonlyArray<string>,
    sensitivityCeiling: string,
  ): Promise<IssuedCredential> =>
    apiClient.post<IssuedCredential>("/credentials", { name, collectionIds, sensitivityCeiling }),
  rotate: (id: string): Promise<IssuedCredential> =>
    apiClient.post<IssuedCredential>(`/credentials/${encodeURIComponent(id)}/rotate`),
  revoke: (id: string): Promise<unknown> =>
    apiClient.delete(`/credentials/${encodeURIComponent(id)}`),
};

export interface CreateItemInput {
  readonly collectionId: string;
  readonly title: string;
  readonly body: string;
  readonly tagIds: ReadonlyArray<string>;
  readonly sensitivity: string;
}

export interface EditItemInput {
  readonly title: string;
  readonly body: string;
  readonly sensitivity: string;
}

export const itemsApi = {
  list: (collectionId?: string, status?: string): Promise<{ items: KnowledgeItemView[] }> =>
    apiClient.get("/items", { collectionId, status }),
  get: (id: string): Promise<KnowledgeItemView> => apiClient.get(`/items/${encodeURIComponent(id)}`),
  versions: (id: string): Promise<{ versions: KnowledgeVersionView[] }> =>
    apiClient.get(`/items/${encodeURIComponent(id)}/versions`),
  create: (input: CreateItemInput): Promise<KnowledgeItemListEntry> =>
    apiClient.post<KnowledgeItemListEntry>("/items", input),
  edit: (id: string, input: EditItemInput): Promise<KnowledgeItemListEntry> =>
    apiClient.put(`/items/${encodeURIComponent(id)}`, input),
  submit: (id: string): Promise<KnowledgeItemListEntry> =>
    apiClient.post(`/items/${encodeURIComponent(id)}/submit`),
  approve: (id: string): Promise<KnowledgeItemListEntry> =>
    apiClient.post(`/items/${encodeURIComponent(id)}/approve`),
  reject: (id: string, reason: string): Promise<KnowledgeItemListEntry> =>
    apiClient.post(`/items/${encodeURIComponent(id)}/reject`, { reason }),
  deprecate: (id: string): Promise<KnowledgeItemListEntry> =>
    apiClient.post(`/items/${encodeURIComponent(id)}/deprecate`),
  archive: (id: string): Promise<KnowledgeItemListEntry> =>
    apiClient.post(`/items/${encodeURIComponent(id)}/archive`),
  rollback: (id: string, versionNumber: number): Promise<KnowledgeItemListEntry> =>
    apiClient.post(`/items/${encodeURIComponent(id)}/rollback`, { versionNumber }),
  retag: (id: string, tagIds: ReadonlyArray<string>): Promise<KnowledgeItemListEntry> =>
    apiClient.post(`/items/${encodeURIComponent(id)}/retag`, { tagIds }),
  move: (id: string, collectionId: string): Promise<KnowledgeItemListEntry> =>
    apiClient.post(`/items/${encodeURIComponent(id)}/move`, { collectionId }),
};

export const collectionsApi = {
  list: (): Promise<{ collections: CollectionView[] }> => apiClient.get("/collections"),
  create: (name: string, description?: string): Promise<{ id: string; name: string }> =>
    apiClient.post("/collections", description === undefined ? { name } : { name, description }),
  rename: (id: string, name: string): Promise<{ id: string; name: string }> =>
    apiClient.put(`/collections/${encodeURIComponent(id)}`, { name }),
};

export const tagsApi = {
  list: (): Promise<{ tags: TagView[] }> => apiClient.get("/tags"),
  create: (label: string): Promise<TagView> => apiClient.post<TagView>("/tags", { label }),
  remove: (id: string): Promise<unknown> => apiClient.delete(`/tags/${encodeURIComponent(id)}`),
};

export const searchApi = {
  search: (
    query: string,
    collectionId?: string,
    sensitivityCeiling?: string,
  ): Promise<{ results: SearchResult[] }> => {
    const body: Record<string, string> = { query };
    if (collectionId !== undefined && collectionId !== "") {
      body.collectionId = collectionId;
    }
    if (sensitivityCeiling !== undefined && sensitivityCeiling !== "") {
      body.sensitivityCeiling = sensitivityCeiling;
    }
    return apiClient.post("/search", body);
  },
  rebuildIndex: (): Promise<{ reprojected: number }> => apiClient.post("/index/rebuild"),
};

export const ingestionApi = {
  upload: (
    collectionId: string,
    filename: string,
    mimeType: string,
    contentBase64: string,
  ): Promise<IngestionUploadAccepted> =>
    apiClient.post<IngestionUploadAccepted>("/ingestion/uploads", {
      collectionId,
      filename,
      mimeType,
      contentBase64,
    }),
  job: (jobId: string): Promise<IngestionJobView> =>
    apiClient.get(`/ingestion/jobs/${encodeURIComponent(jobId)}`),
};

export interface AuditFilter {
  readonly aggregateId?: string;
  readonly actorId?: string;
  readonly eventName?: string;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
}

export const auditApi = {
  events: (filter: AuditFilter): Promise<{ events: AuditEventView[] }> =>
    apiClient.get("/audit/events", {
      aggregateId: filter.aggregateId,
      actorId: filter.actorId,
      eventName: filter.eventName,
      from: filter.from,
      to: filter.to,
      limit: filter.limit,
    }),
};
