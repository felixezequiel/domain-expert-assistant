# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
docker compose up -d        # Start Postgres + pgvector (required — no SQLite anywhere, ADR-018)
npm test                    # Run all tests (node:test via SWC)
npm run test:watch          # Run tests in watch mode
npm run typecheck           # Type check only (tsc, no emit)
npm start                   # Start HTTP + GraphQL servers (MikroORM + Postgres)
npm run migration:create    # Create a new MikroORM migration
npm run migration:up        # Run pending migrations

# Run a single test file
node --import @swc-node/register/esm-register --test src/shared/domain/valueObjects/ValueObject.test.ts
```

## Architecture

DDD template using Hexagonal Architecture (Ports & Adapters) with TypeScript.

**Stack:** TypeScript 5.9 | Node.js 24 | node:test | ESM | SWC on-the-fly (no build step) | MikroORM + Postgres + pgvector

### Layer Structure

```
src/
├── shared/              # Shared kernel (base classes for all bounded contexts)
│   ├── domain/          # Identifier, ValueObject, Entity, AggregateRoot, DomainEvent
│   ├── application/     # UseCase interface, ApplicationService, DomainEventManager, UnitOfWork
│   ├── ports/           # RepositoryPort, EventPublisherPort, LoggerPort
│   └── infrastructure/
│       ├── logging/     # ConsoleLogger, LoggerRegistry, @log decorator
│       ├── events/      # EventEmitterEventBus
│       ├── http/        # HttpServer (GET/POST, route params)
│       ├── graphql/     # GraphqlServer
│       └── persistence/ # AggregateTracker, TrackedUnitOfWork, AggregatePersister
│           └── adapters/  # MikroOrmUnitOfWork, InMemoryUnitOfWork, NoOpUnitOfWork
│
├── modules/<context>/   # Bounded contexts
│   ├── domain/          # Identifiers, ValueObjects, Entities, Aggregates, Events
│   ├── application/     # Commands, Queries, Ports (primary/secondary), UseCases
│   ├── infrastructure/
│   │   ├── http/        # REST controllers
│   │   ├── graphql/     # GraphQL resolvers
│   │   ├── persistence/
│   │   │   ├── in-memory/   # InMemoryRepository (tests)
│   │   │   └── mikro-orm/   # ORM entities, schemas, mappers, repositories, persisters
│   │   └── notifications/
│   ├── bootstrap/       # <Context>Module.ts (vertical slice wiring)
│   └── integrationTests/
│
├── migrations/          # MikroORM migration files
├── mikro-orm.config.ts  # MikroORM configuration (Postgres + pgvector)
├── main.ts              # Composition root (monolith entry point)
└── context/docs/        # Architecture Decision Records (ADRs)
```

**Dependency rule:** dependencies point inward — infrastructure -> application -> domain. Domain never imports from outer layers.

### Key Base Classes

- **Identifier** — UUID-based identity. Subclass for each domain ID (e.g., `UserId extends Identifier`).
- **ValueObject\<Props\>** — Immutable via `Object.defineProperty` with `writable: false`. Equality by value. Props are `protected` — subclasses expose domain-meaningful getters.
- **Entity\<Id, Props\>** — Has identity + protected props. Equality by ID. Subclasses expose getters.
- **AggregateRoot\<Id, Props\>** — Extends Entity. Auto-tracks itself via `setOnTrack()` callback when domain events are added. Supports `reconstitute()` static factory for persistence hydration (no events emitted).

### Automatic Aggregate Tracking & Event Dispatch

Aggregates auto-register themselves for persistence and event draining — use cases don't need to manually return aggregates.

**How it works:**

1. At startup, `AggregateRoot.setOnTrack(callback)` wires a global callback that calls `AggregateTracker.track(aggregate)`
2. `AggregateTracker` uses `AsyncLocalStorage` with a stack-based design for request-scoped, async-safe tracking
3. When a use case calls `aggregate.addDomainEvent(event)`, the aggregate auto-registers itself (once per drain cycle)
4. `TrackedUnitOfWork.begin()` pushes a new scope; `commit()` drains tracked aggregates and delegates to `onCommit(aggregates)`
5. `ApplicationService` gets tracked aggregates from the UnitOfWork, drains their events, dispatches/publishes, then commits

**UseCase returns `Promise<T>` directly** — no wrapper types needed. The tracking infrastructure handles the rest.

**UnitOfWork implementations:**

| Implementation       | Purpose    | Persistence                                                                      |
| -------------------- | ---------- | -------------------------------------------------------------------------------- |
| `MikroOrmUnitOfWork` | Production | Forks the EM and opens a transaction (read-write; `begin(readOnly)` is a seam for the edge) on begin; routes aggregates to `AggregatePersister`s, then flushes + commits on commit; rolls back on error |
| `InMemoryUnitOfWork` | Testing    | Routes aggregates to `InMemoryRepositoryAdapter`s                                |
| `NoOpUnitOfWork`     | Benchmarks | All operations are no-ops                                                        |

### Multi-tenancy, Actor Context & Authorization (ADR-008/009/011)

Cross-cutting machinery the `ApplicationService` applies to every use case. When adding a tenant-scoped aggregate or a guarded use case, follow these conventions:

- **Actor context** — `ActorContext` (`shared/application/context`) is the single source of `{ companyId, actorId, actorType, roles }`, opened only at the edge from the authenticated principal (never client input). `TenantContext.getCurrentCompanyId()` derives from it. `actorType` is `user | consumer | system | operator`; `system`/`operator` are **privileged** (see below).
- **Edge authentication is one shared wrapper, not per-module** — cookie-session routes compose with `authenticatedRoute(sessionResolver, handler)` (`shared/infrastructure/http/authenticatedRoute.ts`): it resolves the principal via `SessionResolverPort` (shared kernel; Identity provides the `CookieSessionResolver` adapter — modules never import Identity's session infra), opens the `ActorContext`, runs the handler, and serializes its `RouteResult` (or a `401 common.unauthorized` / coded error, ADR-026). Routes with no cookie auth (login, invitation accept, operator provisioning) use `publicRoute(handler)`; Consumption authenticates by Bearer API key (its own wrapper). **Authentication is "who" — it stays in this edge wrapper; authorization is "what" — it stays on the use case (`requiredRoles`, below). Never re-implement an `authed`/`respond` helper inside a module.**
- **Events extend `BaseDomainEvent`** — it carries the envelope (`companyId/actorId/actorType`), initialised null. The domain never sets the envelope; the `ApplicationService` **stamps** it between drain and dispatch (`EventEnricher`). Co-locate a small test per event (the TDD gate requires it).
- **Tenant-scoped aggregates implement `TenantScoped`** (expose `get companyId(): string`). On drain the enricher runs a **fail-closed cross-check** `aggregate.companyId === context` and aborts cross-tenant writes (privileged actors are exempt — they act cross-tenant by design).
- **Fail-closed reads** — `MikroOrmUnitOfWork.onBegin` calls `resolveTenantScope(actor)`: a tenant scope enables the `CompanyFilter`; a privileged scope runs unfiltered; no tenant + not privileged **throws**. Every tenant-scoped `EntitySchema` must declare the `CompanyFilter` + a `company_id` column. (Postgres RLS as a second layer is tracked, not yet enabled — see ADR-009 amendment.)
- **Authorization** — a use case opts into role gating by exposing a `requiredRoles: ReadonlyArray<Role>` property (`RoleRestricted`). The `ApplicationService` authorizes via `AuthorizerPort` **before** `execute` (not bypassable by any adapter). `Role` lives in the shared kernel. Business invariants that mention the actor (reviewer ≠ author, last admin) are **domain rules**, not authorization — keep them in the aggregate/use case.
- **Read-model identity (ADR-024)** — to show a user's name in a read view (version author, audit actor), resolve **server-side** via `UserDirectoryPort` (shared kernel; Identity provides the tenant-scoped adapter, like `OrganizationPolicyPort`/ADR-013) and enrich the view in the query use case (`createdByName`/`actorName`; null → UI falls back to the id). **Never** fetch the admin-only roster from a non-admin screen. A consumer that reuses a name-bearing query only for its content (e.g. the Retrieval projection) takes `NullUserDirectory`.

### Command Factory Pattern

Commands use a private constructor + static `of()` factory that receives primitives and constructs VOs internally:

```typescript
CreateUserCommand.of(userId: string, name: string, email: string)
AddAddressCommand.of(userId: string, addressId: string, street: string, number: string, city: string, state: string, zipCode: string)
```

Adapters always call `Command.of()` — never construct VOs directly.

### HTTP Routing

`HttpServer` supports GET and POST with route parameter extraction (`:param` patterns):

```
POST /users                     # Create user
GET  /users/:userId             # Get user by ID
POST /users/:userId/addresses   # Add address to user
```

### Error Codes (ADR-026)

Domain/application errors carry a **stable code** (a translation key), never English prose meant for the user. Throw `DomainError(code, kind, params?, message)` from `shared/domain/errors/` (or subclass it — e.g. `UnauthorizedError`, `RateLimitExceededError` — keeping the class name + signature): `code` is the stable dotted key (`knowledge.collectionNameExists`); `kind ∈ {validation, unauthorized, forbidden, not_found, conflict, rate_limited, unavailable, internal}` maps to the HTTP status; `params` is the flat record the SPA interpolates; `message` is the verbatim English fallback. Every module edge's `respondError` delegates to `toErrorResponse(error)` (`shared/infrastructure/http/`) — `{ error: <code>, message, params? }` at `kind`'s status; a non-`DomainError` → `common.unexpected` (500). There is **no** `statusForError` substring matching. Pick `kind` to **preserve the current status** (this is about codes, not re-statusing). Pure programmer-guard throws may stay bare `Error` (→ 500). The SPA translates `t("errors." + code, { ...params, defaultValue: message })` (`web/src/i18n/locales/*/errors.json`, ADR-025) — an untranslated code degrades to the English `message`, so pt-BR/en-US coverage can lag the backend.

### Persistence Layer (MikroORM)

- **ORM entities** are plain classes (no domain coupling) in `persistence/mikro-orm/entities/`
- **All ORM entity classes MUST `extends PlainObject`** from `@mikro-orm/core`. MikroORM uses property accessors (proxies) on managed entities; without `PlainObject`, calling `em.upsert(SomeClass, plainInstance)` re-uses identity-mapped proxies and returns proxy values from getters, breaking mappers and triggering subtle hydration bugs. `PlainObject` opts the class out of MikroORM's hydration interception so mappers can read raw primitives safely. Includes child entities (e.g., `AddressEntity`) — every class registered in an `EntitySchema` must extend it.
- **EntitySchema** definitions in `persistence/mikro-orm/schemas/` (no decorators on entities)
- **Mappers** convert between domain aggregates and ORM entities (`toDomain()` / `toOrmEntity()`)
- **AggregatePersister** interface: each module provides a persister that `supports()` its aggregate type and `persist()`s it
- **Flush ownership (ADR-004): no repository ever calls `em.flush()`.** The single flush/commit is owned by `MikroOrmUnitOfWork.onCommit`, whose `em.transactional()` flushes the whole EM unit of work — event store + aggregates + any staged `persist()` — in one transaction. **Mutable aggregates** are written by their `AggregatePersister` (`em.upsert()` _inside_ that transaction) via the tracking path — never via `repo.save()` during `execute()` (an `upsert` there runs immediately, outside the UoW). **Insert-only/append-only writes** (sessions, version snapshots) stage with `em.persist()` in the repository and are flushed by the same commit.
- Domain `reconstitute()` factories hydrate aggregates from persistence without emitting domain events
- Postgres is the single engine (domain + event store + derived vector index, ADR-018); connection via `POSTGRES_*` env vars (defaults match `docker-compose.yml`). pgvector extension lives in the same database. No SQLite in any environment.

## Curation & Admin SPA (`web/`, ADR-023 + amendment)

The human UI is a **React + Vite SPA** in `web/` — outside the hexagon, a pure REST client that never duplicates domain rules. Build it (`cd web && npm run build`) before serving; `SpaController` serves `web/dist` per request (no server restart needed for SPA-only changes). It serves `index.html` with `Cache-Control: no-cache` so a rebuild's content-hashed `/assets/*` are picked up on the next load (without it browsers cache the entry HTML and keep loading stale bundles).

- **UI system:** shadcn/ui + Tailwind v3 + **design tokens** (HSL CSS vars in `web/src/styles.css`, mapped in `tailwind.config.js`). Primitives live in `web/src/components/ui/`; `cn()` in `lib/utils.ts`; icons `lucide-react`; toasts `sonner` (`toast.success/error` — not persistent inline notices). Import alias `@/ → web/src`. Dark theme + blue accent; retune the brand from `--primary`/`--ring`. Display serif (titles/brand), grotesk body, mono for IDs/keys. **Every control is a shadcn primitive — no native form widgets**: dates use `DateRangePicker` (Calendar + Popover, not `<input type="date">`), the mobile drawer is `Sheet`, the user chip is `Avatar`, quick-nav is `command`. The only native control is `FileDropzone`'s hidden `<input type="file">` (no shadcn file primitive — the dropzone is the styled wrapper).
- **Auth/session:** httpOnly session cookie (ADR-010). On boot, `AuthContext` calls `GET /auth/me` to rehydrate the session from the cookie (a hard refresh stays signed in). Capabilities (`canAdminister/canAudit/canCurate/canReview`) are derived from the roles in `/auth/me` — a **UX hint only**; server authorization (ADR-011) is the real gate. `RequireCapability` guards admin/auditor routes; `Layout` tailors the nav.
- **Routing & navigation:** HashRouter (the monolith serves only `/`, `/index.html`, `/assets/*`). `/` is a role-aware `DashboardPage` (capability-tailored metrics + quick actions). Org config lives under `/settings/*` behind a tabbed `SettingsLayout`; detail screens use `Breadcrumbs`. A global `CommandPalette` (⌘K / Ctrl+K, in the top bar) offers capability-filtered jump-to navigation.
- **Data:** typed wrappers in `api/resources.ts` over `apiClient` (`credentials: "include"`); load with the `useAsync` hook (wrap non-table content in `<AsyncBoundary>`); shared formatting (dates, markdown-strip, lifecycle `statusBadge`) in `lib/format.ts`. Tables render `TableSkeletonRows`/`TableEmptyRow` (from `components/TableState.tsx`) for their loading/empty states with the error notice above, rather than collapsing to a spinner.
- **i18n (ADR-025):** `react-i18next`, two locales — **pt-BR (default)** + `en-US` — persisted in `localStorage`, switched by `LanguageSwitcher` in the top bar; init in `src/i18n/index.ts`. **No hardcoded user-facing strings**: use `const { t } = useTranslation()` and `t("section.key")`. Resources are bundled JSON, one section file per area under `src/i18n/locales/<lng>/<section>.json` (single `translation` namespace, dotted keys); generic copy lives in `common` (`common.actions.*`, `common.status.<lifecycle>`, `common.sensitivity.*`, `common.roles.*`, `common.errors.*`) and chrome in `nav`. **`en-US` values are the verbatim original English copy**, and tests pin `en-US` (`src/test/setup.ts` initialises i18n) so existing English assertions hold. Dates are locale-aware via `lib/format.ts`.
- **Monaco (VS Code) editing:** version comparison (`VersionDiff` → `MonacoVersionDiff`, a read-only `DiffEditor`) and the markdown **body write surface** (`MarkdownEditor` → `MonacoMarkdownEditor`, an `Editor`) both use Monaco, themed Monokai, via the shared `components/monacoSetup.ts`. `@monaco-editor/react` + `monaco-editor` are bundled **locally** (not the default CDN — same-origin/offline, ADR-023/024) and each Monaco component is **lazy-loaded** into its own chunk, so only the screen that needs it pays the weight. The import/upload path (`FileDropzone`) is unaffected.
- **MCP onboarding:** when a consumer credential is issued/rotated, `SecretRevealDialog` shows the one-time key **and** a ready-to-paste MCP config + step-by-step for a chosen AI client. The compatible-client catalog lives in `lib/mcpClients.ts` (each entry generates the snippet from the live origin + key); steps are in `admin.credentials.mcp.steps.<id>` (both locales). We only list clients that accept a **remote (Streamable HTTP) MCP server with a Bearer API key** — what the gateway exposes at `/mcp` (ADR-021). **To add a client:** add a catalog entry + its `steps.<id>` array in both locales (and a snippet assertion in `mcpClients.test.ts`).
- **Tests:** co-located `*.test.tsx` (vitest + Testing Library); avoid asserting deep Radix Select/Dialog interactions in jsdom — prefer rendered text/roles. **Monaco can't run in jsdom**: mock `@monaco-editor/react` (stub `DiffEditor`/`Editor`), and `monaco-editor` + its `?worker` are aliased to `src/test/monaco` stubs in `vite.config.ts` (`test.alias`); a screen that renders a Monaco component (e.g. `ItemEditorPage`) mocks the wrapping component. The real editors are verified via the build + a browser check.

## TypeScript Constraints

- **Decorators** require SWC — `@swc-node/register/esm-register` transforms legacy TS decorators at runtime. They do NOT work with native Node.js type stripping.
- **`exactOptionalPropertyTypes: true`** — optional props need explicit `| undefined` in type declarations.
- **Generic constraints** — use `object` instead of `Record<string, unknown>` to accept TS interfaces.
- **ValueObject/Entity encapsulation** — `props` is `protected`. Subclasses must expose public getters with domain-meaningful names (e.g., `get value()` not `props.value`).
- **ValueObject immutability** — `Object.defineProperty` enforces runtime immutability; `readonly` alone is compile-time only. Use `props!: Props` (definite assignment assertion) when set via `Object.defineProperty`.

## Test Conventions

- **Co-located:** `Foo.ts` + `Foo.test.ts` side by side in the same directory.
- **Integration tests** in `<module>/integrationTests/`.
- **Performance benchmarks** in `<module>/performanceTests/`.
- **Framework:** `node:test` (`describe`/`it`) + `node:assert/strict`.
- **UnitOfWork in tests:** use `InMemoryUnitOfWork` with `InMemoryRepositoryAdapter`. Set up `AggregateRoot.setOnTrack()` + `AggregateTracker.track()` in `beforeEach`, reset with `setOnTrack(null)` in `afterEach`.
- Fakes/spies use in-memory implementations.
- **Application unit tests depend on ports, not infra.** Co-located application tests (e.g. `application/usecase/*.test.ts`) must NOT import a concrete infrastructure adapter — the hexagonal pre-commit check forbids `application/ → infrastructure/`. Put a module's in-memory port fakes in `modules/<context>/application/testDoubles/index.ts` (the `index.ts` name is also exempt from the co-located-test gate) and import those. The MikroORM adapters stay the production path; integration tests under `integrationTests/` may import infra freely.
