# Domain Expert Assistant — PRD Behavior Validation Report

**Date:** 2026-06-17
**Branch:** `feat/domain-expert-implementation`
**Method:** Multi-agent validation against all 7 PRDs (`docs/prds/000`–`006`):
- **Two browser agents** (Playwright MCP) drove the live SPA across every persona and every lifecycle status — run **serially** (single shared browser).
- **One curl agent** validated the Consumption Gateway (`/v1/*` REST + `/mcp` JSON-RPC) end-to-end in an isolated tenant.
- **One read-only agent** mapped every PRD acceptance criterion + the full status/enum inventory against the code.

**Stack under test:** TS/Node 24 · MikroORM + Postgres + pgvector · React 18 + Vite (HashRouter) · BGE-M3 local embeddings · server restarted on the latest code (`OPERATOR_SECRET=dev-operator-secret`), seeded test org.

---

## 0. Resolution status (2026-06-17)

**All findings below were addressed in the same follow-up commit.** Summary of the fixes:

- **§3 B1** — Knowledge routes now map `Forbidden → 403` (was 500); the mapping was also added to the Ingestion, Retrieval and Consumption modules for consistency.
- **§3 B2 / §5 P2** — content + tags are now one `edit` (single version); a no-op Save creates no version/event.
- **§3 B3** — "Move to collection" is surfaced in the editor (changing the collection on Save moves the item).
- **§4 S1** — configurable ingestion upload size limit (`INGESTION_MAX_UPLOAD_BYTES`, default 10 MiB), enforced at reception → 400.
- **§4 S2** — the drafting event is now stamped with `causationId = jobId`, correlating an ingested item to its upload (dedicated `KnowledgeItemCreatedFromDocument`/`TextExtracted` events remain a future enhancement — PRD-3 §6 updated).
- **§4 S3** — collection deletion is recorded as an explicit **v1 deferral** (no delete path in the event-sourced/upsert persistence — PRD-2 §4 updated).
- **§4 tags filter** — made **real** (chunk `tag_ids` + GIN index, `Migration_011`, array-overlap search; ADR-020 amended); **phantom `restricted` sensitivity** removed.
- **§4 PATCH/PUT & `suspended`** — PRDs aligned to the implemented `PUT` verbs; the unreachable `Organization.suspended` status removed (PRD-1 note added).
- **§5 P1/P4/P5/P6/P7** — search snippet no longer duplicates the title; `/v1/search` accepts `query` as an alias for `q`; score tooltip rounded; real `/favicon.svg` served (no console 404); the raw user UUID is gone from the invite panel.
- **Golden-set** — a deterministic RRF-fusion relevance test was added (hybrid beats vector-only and lexical-only).
- **Not fixed (deliberate):** credential-scope collection-existence validation — would require a new cross-module port; left as-is since the fail-closed read path already bounds the impact. Rate-limit `429` remains code-verified (not load-tested).

**Verification:** backend **772 tests pass**, web **109 tests pass**, typecheck + SPA build clean, `Migration_011` applied. The findings below are the original point-in-time observations.

---

## 1. Executive summary

The product is **functionally complete and behaves to spec across all 7 PRDs**. The entire knowledge lifecycle runs end-to-end through the real UI and the machine APIs: author → submit → approve → publish → project into pgvector → semantic search → serve over `/v1` REST **and** the MCP gateway → captured in the audit trail. **RBAC is enforced server-side** (correct 403s where the surface maps them), tenant isolation is fail-closed (including the raw pgvector path via RLS), disabled users and revoked/rotated keys are locked out, and there were **no uncaught JS/React errors and no HTTP 500s in any UI flow**. The prior E2E round's fixes all hold (B2 login error, B3 stale toast, B5 revoked actions hidden, S1 capability guard, U2 names, U6 invite context, U10 policy prefill, U11 rejection banner, U13 confirms, U17 reject-disabled).

The remaining items are mostly **polish and a few spec gaps**, not core-correctness failures:

- **1 cross-cutting bug worth fixing now:** role-gated **Knowledge** routes return **HTTP 500 instead of 403** on an authorization failure (status mapping gap — Consumption & Identity map it correctly).
- **2 medium behavior gaps:** a single Save that also changes tags creates **two** versions (the B1 fix only covered the no-tag-change path); **"move item to another collection" has no UI** (the API exists, nothing calls it).
- A cluster of **low-severity polish** items (search snippet duplicates the title, no-op Save still versions, stale editor buttons, favicon 404, etc.).
- Several **PRD divergences** the spec authors should rule on (ingestion size limit, ingestion event/causation model, collection deletion policy, `tags` search filter being a no-op).

**Severity counts:** **0 High · 6 Medium · ~13 Low.** None are release blockers for an internal tool.

---

## 2. Coverage — what was exercised

| PRD | Area | Result |
|---|---|---|
| **000** Foundation | Actor-context envelope, tenant isolation (fail-closed reads + write cross-check), operator events invisible to tenant auditors | ✅ (verified via audit trail + multi-tenant curl run) |
| **001** Identity & Access | Operator provision, login (valid/invalid), logout, `/auth/me` refresh, invite→accept→activate, change roles, **disable + lockout**, org policy, credential **issue/rotate/revoke**, RBAC nav + direct-URL capability guards | ✅ |
| **002** Knowledge Core | Lifecycle **draft → in_review → published → deprecated → archived**, **reject→draft**, **rollback→draft**, versioning + diff, retag, markdown preview, tags (system read-only / tenant / in-use block) | ✅ (findings) |
| **003** Ingestion | Upload → job (pending→processing→done) → auto-created **draft**, title derivation, FileDropzone | ✅ (findings) |
| **004** Retrieval & Indexing | Projection worker, semantic (no-keyword) search, deprecated-stays-stale, scope/sensitivity filter, RRF hybrid | ✅ (findings) |
| **005** Consumption Gateway | `/v1/search·lookup·collections·tags·items/:id`, effectiveScope echo, scope **403** + sensitivity ceiling (fail-closed), revoked/invalid token **401**, **MCP** initialize/tools-list(5)/tools-call, REST↔MCP parity, unknown-tool error | ✅ (1 finding) |
| **006** Curation & Admin UI | All persona screens, command palette, breadcrumbs, toasts, empty states, dashboard role-aware, **responsive drawer**, U2 names, U6 invite context | ✅ (findings) |

**Statuses/transitions actually driven:** KnowledgeItem `draft·in_review·published·deprecated·archived` + `reject→draft` + `rollback→draft`; User `invited→active` + `active→disabled`(+lockout); IngestionJob `pending→processing→done`; ConsumerCredential `active→revoked`(+rotate). **Not exercised live:** rate-limit `429` (code-verified, not fired to avoid polluting the shared limiter), golden-set relevance, IngestionJob `failed` path, Organization `suspended` (no operation exists — see §4).

---

## 3. Bugs (functional)

### 🟠 B1 — Knowledge authorization failures return **HTTP 500** instead of **403**
Every role-gated Knowledge route (`POST /collections`, `POST /items`, `/items/:id/submit|approve|reject|deprecate|archive|...`) returns **500** with body `{"error":"Forbidden: requires one of the roles [...]"}` when the actor lacks the role.
**Root cause:** `UnauthorizedError` is thrown as `"Forbidden: requires one of the roles [...]"` (`RoleBasedAuthorizer` / `ApplicationService`), and `IdentityModule.statusForError` maps `startsWith("Forbidden") → 403`, **but `KnowledgeModule.statusForError` has no `Forbidden` branch** → falls through to `HTTP_INTERNAL_ERROR`. `src/modules/knowledge/bootstrap/KnowledgeModule.ts:361-375`.
**Evidence (curl):** `curl -b curator.jar -X POST /collections -d '{"name":"x"}'` → `500 {"error":"Forbidden: requires one of the roles [admin]."}`; same for reviewer→`POST /items`, curator→`/approve`.
**Impact:** a legitimate "you lack the role" is reported as a server error — wrong contract, masks the real 403. (The UI mostly avoids this via `RequireCapability`, so it surfaces on the API surface.)
**Fix:** add `if (message.startsWith("Forbidden")) return HTTP_FORBIDDEN;` to `KnowledgeModule.statusForError` (add the 403 constant). Better: centralize the `UnauthorizedError → 403` mapping in a shared helper so every module agrees (Consumption already maps `ScopeViolationError → 403`; only Knowledge diverges).

### 🟠 B2 — A single Save that changes tags creates **two** versions (B1 fix incomplete)
`ItemEditorPage.save()` calls `itemsApi.edit()` and, when tags changed, `itemsApi.retag()`; both `KnowledgeItem.edit()` and `.retag()` call `openNewWorkingVersion`, so one Save = **two** versions.
`web/src/pages/curator/ItemEditorPage.tsx:80-102`; `src/modules/knowledge/domain/aggregates/KnowledgeItem.ts:180-194`.
**Evidence:** one Save with a single added tag produced **v4 (edit) + v5 (retag)**. (The earlier B1 fix correctly suppresses the *no-op* retag when tags are unchanged — that path is clean — but doesn't coalesce a genuine content+tag change.)
**Fix:** fold tags into the single `edit` payload (server coalesces content+tags into one version), or have the backend merge an edit+retag in the same request.

### 🟠 B3 — "Move item to another collection" has no UI
`itemsApi.move` exists (`web/src/api/resources.ts:116-117`) but is never called; the editor's Collection `<Select>` is `disabled` on edit (`ItemEditorPage.tsx:152`). PRD-002 lists moving items between own-org collections, and the backend `MoveItemToCollectionUseCase` works — but a user can't trigger it.
**Fix:** add a "Move" control (item editor or items list) that calls `itemsApi.move`.

---

## 4. Spec gaps & divergences (PRD authors to rule on)

### 🟠 S1 — Ingestion file-size limit not enforced (PRD-3 §5/§10)
Mime is validated (`MimeType.ts`) and empty content rejected (`IngestionCommands.ts:33`), but there is **no max-size check** — a client can upload arbitrarily large base64 bodies. Add a configurable size guard at the edge / in `UploadDocumentCommand`.

### 🟠 S2 — Ingestion event model diverges from PRD-3 §6 (no audit linkage)
Spec calls for `TextExtracted` + `KnowledgeItemCreatedFromDocument` linked to `KnowledgeItemDrafted` via `causationId`. Implementation emits `DocumentUploaded/IngestionStarted/IngestionCompleted/IngestionFailed/IngestionRequeued` — **no `KnowledgeItemCreatedFromDocument` and no causationId** linking the upload to the resulting draft, so the audit trail can't correlate "this item came from this upload." Functionally fine; misses the PRD's audit-linkage intent.

### 🟠 S3 — Collection deletion / "not deletable with items" rule not implemented (PRD-2 §5/§7)
Only `CreateCollection`/`RenameCollection` exist — no delete use case or UI, and the "can't delete a non-empty collection" policy is unimplemented and undocumented as a deferral. Decide: implement, or record as a deliberate v1 deferral.

### 🟡 Lower-severity divergences
- **`tags` search filter is a no-op** (`KnowledgeQueryFacade.filterByTags`) — the chunk index carries no tag ids, so `/v1/search(..., tags)` and the MCP `search_knowledge` tool **silently ignore `tags`** (honestly documented in code, but the tool contract over-promises; `lookup` is the tag-precise path).
- **Phantom `restricted` sensitivity** in `MikroOrmChunkIndexRepository.buildScopeFilter` (`ARRAY[...,'restricted']`) — the domain has only `public/internal/confidential`; dead/inconsistent value.
- **Golden-set relevance test missing** (PRD-4 §10) — RRF hybrid is implemented but the "hybrid beats vector-only/lexical-only" acceptance bar has no test.
- **`Organization.status = 'suspended'`** is defined but unreachable (no suspend operation/endpoint).
- **REST verb divergence** — PRDs spec `PATCH` for roles/policy/item/collection updates; implementation uses `PUT`. Cosmetic but a literal contract check flags it.
- **Credential scope collection-existence validation unconfirmed** — `IssueConsumerCredentialUseCase` builds `CredentialScope` from raw ids without a confirmed "collection exists in this org" check (impact bounded by the fail-closed read path; a bad id simply matches nothing).

---

## 5. UX / polish improvements

| # | Sev | Finding | Suggested fix |
|---|---|---|---|
| P1 | 🟡 | **Search snippet duplicates the title.** Indexing prepends the title to the chunk text (`IndexingUseCases.ts:51`), so `result.content` starts with the title, which the card renders right under the title heading. | Keep the title in the embedding (recall), but strip the leading title from the *displayed* snippet (`SearchPage.tsx` `snippetOf`, ~L28-34). |
| P2 | 🟡 | **No-op Save still creates a version.** `KnowledgeItem.edit()` opens a new working version even when title/body/sensitivity are unchanged (a zero-change Save produced v3). | Short-circuit `edit()` (and/or the editor's Save) when nothing changed. |
| P3 | 🟡 | **Stale editor actions on a submitted item.** The editor still shows Save / Submit for an item already `in_review` (`ItemEditorPage.tsx:209-214` gates on `isEdit`, not status); a second Submit 400s. | Hide/disable Submit (and Save) when `status !== draft`. |
| P4 | 🟡 | **`/v1/search` silently returns empty for an unknown query param.** The param is `q` (matches PRD-5 §7); `?query=` yields `200 {results:[]}` with no hint. | Accept `query` as an alias, or 400 when neither recognized param is present. |
| P5 | 🟡 | **Score tooltip exposes an unrounded float** (`relevance score 0.01639344262295082`, `SearchPage.tsx:174`). Display is otherwise hidden (good). | Round the tooltip to ~2 decimals. |
| P6 | 🟡 | **`/favicon.ico` 404.** Only an inline data-URI `<link rel="icon">` exists; the browser still fetches `/favicon.ico` → 404 in console. | Add `web/public/favicon.svg`/`.ico` (Vite copies `public/`) or have `SpaController` serve `/favicon.ico`. |
| P7 | 🟡 | **Invite success panel shows a raw "User id: <UUID>"** (`UsersPage.tsx:248-250`) next to the (useful) token + copy-link — developer-facing noise. | Drop the raw user id or hide it behind a details affordance. |

---

## 6. What works well (don't regress)

- **Full lifecycle**, all five statuses + reject→draft + append-only rollback→draft, with status-gated lifecycle actions (U15) and the rollback confirmation (B4).
- **Server-side RBAC** (correct 403 where mapped) + **client capability guards** (`RequireCapability`, S1) — defense in depth.
- **U2 identity resolution**: version-history Author and audit Actor show display **names**, not UUIDs (fall back to id when unresolved); top bar shows name+email.
- **U6 invite/accept**: the accept screen shows org + invited email + role badges; bogus token → "Invitation not found". `GET /invitations/:token` returns exactly `{organizationName, email, roles}`; 404 for unknown.
- **Consumption parity & isolation**: REST and MCP return identical scoped payloads; MCP exposes 5 tools; out-of-scope → 403, over-ceiling sensitivity is invisible (search/lookup/getItem all fail-closed, no metadata leak); deprecated items stay served flagged `stale` (S3); revoked/rotated/invalid keys → 401; `lastUsedAt` tracked.
- **Async pipelines**: upload → job → auto-draft with H1-derived title (U9); publish → projection worker indexes in <1s; deprecate → still searchable+stale; archive → removed.
- **UI quality**: markdown preview + color-coded diff, toasts (no stale notices, B3), empty states, command palette, breadcrumbs, responsive sidebar→drawer, **no uncaught JS/React errors, no 500s in any UI flow.**

---

## 7. Prioritized recommendations

**Fix now (cheap, correct-contract):**
1. **§3 B1** — map `UnauthorizedError → 403` in `KnowledgeModule` (ideally centralize for all modules).
2. **§3 B2** — coalesce content+tag Save into one version.
3. **§3 B3** — surface "Move to collection" in the UI (API already exists).

**Decide (product/spec):**
4. **§4 S3** — collection deletion policy: implement or record the deferral.
5. **§4 S1** — add the ingestion size limit (it's an unbounded-input gap).
6. **§4 S2** — add `causationId` linkage (and/or the `KnowledgeItemCreatedFromDocument` event) so the audit trail correlates uploads to items.
7. **§4** — make the `tags` search filter real, or drop it from the `search` tool contract.

**Polish:** §5 P1–P7 (snippet title de-dup, no-op-save guard, stale buttons, query alias, score rounding, favicon, invite panel).

---

## Appendix — environment & accounts

- Server restarted on the latest branch code with `OPERATOR_SECRET=dev-operator-secret`; the new `GET /invitations/:token` confirmed live before validation.
- Seeded org **"Acme Knowledge E2E"**: `ada@e2e.test` (admin), `carl.curator@e2e.test` (curator), `rita.reviewer@e2e.test` (reviewer) — all active; `amy.auditor@e2e.test` remains **disabled** (its 401 is the expected disabled-lockout). A fresh **`neo.auditor@e2e.test` (auditor, active)** was created via the U6 invite→accept flow.
- The curl agent ran in a **separate isolated org** (`API Validation …`) so it never interfered with the browser org.
- Test artifacts left in place (throwaway local data): two items in "Engineering Handbook v2" (one archived w/ 6 versions, one rejected draft), an ingested "Onboarding Guide" draft, and a `dispo.tester@e2e.test` disabled account.
- **Not exercised live:** rate-limit `429` (code-verified; not fired to protect the shared in-memory limiter), golden-set relevance, IngestionJob `failed` path, Organization `suspended` (no operation).

### Status/enum inventory (from code)
- **Roles:** admin, curator, reviewer, auditor, consumer · **ActorType:** user, consumer, system, operator (last two privileged) · **Sensitivity:** public < internal < confidential.
- **KnowledgeItem:** draft, in_review, published, deprecated, archived (all transitions guarded; `isServed = publishedVersionNumber!=null && !archived`; `isStale = deprecated`).
- **User:** invited → active → disabled · **IngestionJob:** pending → processing → done | failed (+ requeue) · **ConsumerCredential:** active → revoked · **Tag scope:** system (immutable) | tenant · **Organization:** active | suspended (suspended unreachable).
