# DDD Template

> **TypeScript template for DDD + Hexagonal (Ports & Adapters) services.**
> Battle-tested building blocks (event store, transactional Unit of Work, automatic
> aggregate tracking, multi-tenancy, SSE, observability) with a complete `User`
> reference module so you can clone, read one feature end-to-end, and ship yours.

[![CI](https://github.com/felixezequiel/ddd-template/actions/workflows/ci.yml/badge.svg)](https://github.com/felixezequiel/ddd-template/actions/workflows/ci.yml)
[![Node 24+](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](.nvmrc)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](#license)

## Stack

- **TypeScript 5.9** (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`)
- **Node.js 24+** with native test runner (`node:test`) — no Jest, no Vitest
- **SWC** on-the-fly transpilation — no build step
- **ESM** modules
- **MikroORM 7** + **SQLite** (default) — switch to Postgres in 4 lines (see [Switching databases](#switching-databases))
- **GraphQL** built in alongside REST
- **ESLint 9** flat config + **Prettier** + GitHub Actions CI

## Quickstart

```bash
git clone <your-fork> my-service && cd my-service
nvm use                     # or ensure Node 24+
npm install
npm start                   # boots REST :3000 and GraphQL :4000

# in another terminal
curl http://localhost:3000/health/live
# → {"status":"ok"}

curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'
# → {"id":"...","name":"Alice","email":"alice@example.com"}
```

That's it — migrations run automatically on boot, the SQLite file is created under `data/`,
and you have a working DDD service with event store, correlation IDs, health checks
and a domain event handler firing the welcome-email side effect.

## Add your first bounded context

The template includes a complete `User` module as reference. To add a `Product`
(or whatever your domain is), follow the step-by-step:

**👉 [docs/adding-a-bounded-context.md](docs/adding-a-bounded-context.md)**

The walkthrough covers domain → application → in-memory repo → MikroORM repo →
module bootstrap → `main.ts` wiring → migration → smoke test, with every snippet
ready to copy.

## Commands

```bash
npm start                  # boot REST :3000 + GraphQL :4000 (runs migrations on boot)
npm test                   # all tests (currently 402)
npm run test:unit          # exclude integration / performance tests
npm run test:changed       # tests for files changed since HEAD (fast TDD loop)
npm run test:watch         # watch mode
npm run typecheck          # tsc --noEmit
npm run lint               # ESLint
npm run lint:fix           # ESLint --fix
npm run format             # Prettier --write
npm run format:check       # Prettier --check (CI)
npm run bench              # tinybench performance suite
npm run migration:create -- --name=MyMigration   # generate a new migration
npm run migration:up                              # apply migrations (also runs on npm start)
```

## API surface (reference module)

```
POST /users                     create user
GET  /users/:userId             get user with addresses
POST /users/:userId/addresses   add address to user
GET  /health/live               liveness probe
GET  /health/ready              readiness probe (checks DB connection)

POST /graphql                   GraphQL endpoint
```

GraphQL example:

```graphql
mutation {
  createUser(input: { name: "Alice", email: "alice@example.com" }) {
    id
    name
    email
  }
}
```

## Project structure

```
src/
├── shared/              # Shared kernel — base classes for every bounded context
│   ├── domain/          # Identifier, ValueObject, Entity, AggregateRoot, DomainEvent
│   ├── application/     # UseCase, ApplicationService, UnitOfWork, DomainEventManager, Pagination
│   ├── ports/           # RepositoryPort, EventPublisherPort, EventStorePort,
│   │                    # LoggerPort, EmailPort, SseBroadcasterPort
│   └── infrastructure/
│       ├── http/        # HttpServer (GET/POST/PUT/DELETE, raw routes, static, CORS)
│       ├── graphql/     # GraphqlServer
│       ├── persistence/ # AggregateTracker, TrackedUnitOfWork, MikroOrm/InMemory adapters
│       ├── events/      # EventEmitterEventBus
│       ├── logging/     # ConsoleLogger (correlation-id aware)
│       ├── sse/         # SseService, SseBroadcaster, NoOpSseBroadcaster
│       ├── email/       # ConsoleEmailAdapter, SmtpEmailAdapter (nodemailer)
│       └── alerts/      # AlertPort, ConsoleAlertAdapter, ErrorHandler
│
├── modules/<context>/   # Bounded contexts (vertical slices)
│   ├── domain/          # Identifiers, ValueObjects, Entities, Aggregates, Events
│   ├── application/     # Commands, Queries, Ports (primary/secondary), UseCases
│   ├── infrastructure/  # REST controllers, GraphQL resolvers, persistence adapters
│   ├── bootstrap/       # <Context>Module.ts (wires deps, registers routes)
│   └── factories/       # <Context>ModuleFactory (composition root helper)
│
├── migrations/          # MikroORM migrations
├── mikro-orm.config.ts  # MikroORM configuration
└── main.ts              # Composition root

docs/
├── architecture.md             # Full request flow + Mermaid diagram
├── adding-a-bounded-context.md # Step-by-step walkthrough
└── adrs/                       # Architecture Decision Records
```

**Dependency rule:** `infrastructure → application → domain`. Domain never imports outward.

For the full request flow with diagram, see **[docs/architecture.md](docs/architecture.md)**.

## Core building blocks

These are always present and you'll use most of them in every module.

| Pattern                        | What it gives you                                                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Identifier**                 | UUID-based identity. Subclass once per domain id (`UserId extends Identifier`)                                                                                                           |
| **ValueObject\<Props\>**       | Immutable via `Object.defineProperty`. Protected props, public getters, equality by value                                                                                                |
| **Entity\<Id, Props\>**        | Identity + protected props. Equality by id                                                                                                                                               |
| **AggregateRoot\<Id, Props\>** | Auto-tracks itself when emitting events. `markForDeletion()` routes deletes through the persister. `reconstitute()` for hydration without firing events                                  |
| **DomainEvent**                | `{ eventId, eventName, aggregateId, occurredAt, causationId }`                                                                                                                           |
| **Command**                    | Private constructor + static `of(...primitives)` factory. Adapters never construct VOs directly                                                                                          |
| **UseCase**                    | Returns `Promise<T>` directly — no envelope                                                                                                                                              |
| **ApplicationService**         | One method `execute(useCase, command)`. Orchestrates `begin → execute → drain → dispatch → publish → saveAll → commit → broadcast`                                                       |
| **TrackedUnitOfWork**          | Stack-based aggregate tracking via `AsyncLocalStorage`. Three impls: `MikroOrm`, `InMemory`, `NoOp`                                                                                      |
| **AggregatePersister**         | Per-aggregate strategy. `MikroOrmAggregatePersister` is generic — pass a config (`aggregateClass`, `ormEntityClass`, `toOrmEntity`, optional `cleanupNestedEntities` and `deleteEntity`) |
| **EventStorePort**             | All domain events persisted to `system_events` **in the same transaction** as aggregate writes — no dual-write                                                                           |

### Conventions worth knowing

**Use cases never call `repository.save()`.** Aggregates auto-track on the first
`addDomainEvent()`, and the `MikroOrmUnitOfWork` flushes everything inside `em.transactional()`
on commit:

```ts
// ❌ Don't do this
public async execute(cmd: CreateUserCommand): Promise<User> {
  const user = User.create(cmd.userId, cmd.name, cmd.email);
  await this.repository.save(user); // unnecessary
  return user;
}

// ✅ Do this — the tracker handles persistence
public async execute(cmd: CreateUserCommand): Promise<User> {
  return User.create(cmd.userId, cmd.name, cmd.email);
}
```

**Adapters always call `Command.of()`.** Primitives in, VO construction inside:

```ts
// ❌ Don't construct VOs in adapters
const cmd = new CreateUserCommand(
  new UserId(uuid()),
  new UserName(body.name),
  new Email(body.email),
);

// ✅ Use the static factory
const cmd = CreateUserCommand.of(body.name as string, body.email as string);
```

**MikroORM ORM entities MUST `extends PlainObject`.** Including children. Without
it, MikroORM wraps instances in tracking proxies; `em.upsert(Class, instance)`
returns proxy values to your mappers and you get hydration bugs that look random.
**This is the #1 footgun.**

**ValueObjects use `protected` props.** Subclasses expose domain-meaningful getters
(e.g. `get value()` not `props.value`). Immutability is enforced at runtime via
`Object.defineProperty`.

### Test conventions

```ts
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { AggregateRoot } from "../../shared/domain/aggregates/AggregateRoot.ts";
import { AggregateTracker } from "../../shared/infrastructure/persistence/AggregateTracker.ts";
import { InMemoryUnitOfWork } from "../../shared/infrastructure/persistence/adapters/InMemoryUnitOfWork.ts";

describe("CreateUserUseCase", () => {
  beforeEach(() => {
    AggregateRoot.setOnTrack((a) => AggregateTracker.track(a));
  });
  afterEach(() => {
    AggregateRoot.setOnTrack(null);
  });

  it("creates a user", async () => {
    const repository = new InMemoryUserRepository();
    const uow = new InMemoryUnitOfWork([
      { supports: (a) => a instanceof User, save: (a) => repository.save(a as User) },
    ]);
    // ... arrange ApplicationService, exercise the use case, assert
  });
});
```

- Co-located: `Foo.ts` next to `Foo.test.ts`.
- Integration tests in `<module>/integrationTests/`.
- Performance benchmarks in `<module>/performanceTests/`.
- Framework: `node:test` (`describe` / `it`) + `node:assert/strict`.

## Optional features

These ship in the shared kernel and are **wired by default but inert** until you
configure them.

### Multi-tenancy (CompanyFilter)

1. Add `companyTenantFilterDefinition` to your tenant-scoped `EntitySchema` under `filters`.
2. Wrap request handlers in `runWithTenant(companyId, async () => ...)` (e.g. inside an auth middleware that decodes your token).
3. `MikroOrmUnitOfWork.onBegin()` calls `setFilterParams` automatically based on `getCurrentCompanyId()`.

When no tenant is active (public routes, scheduled jobs without a company scope),
the filter returns `{}` — queries pass through unchanged.

### SSE broadcasting

Every domain event is broadcast post-commit to:

- `event.aggregateId` — per-aggregate channel
- `__admin__` — global firehose

To expose endpoints, register raw routes in `main.ts`:

```ts
infrastructure.httpServer.rawGet("/events/:channelId", (_req, res, params) => {
  infrastructure.sseService.addClient(params.channelId, res);
});
```

To **disable SSE**, swap the broadcaster in `shared/factories/index.ts`:

```ts
import { NoOpSseBroadcaster } from "../infrastructure/sse/NoOpSseBroadcaster.ts";
const sseBroadcaster = new NoOpSseBroadcaster();
```

### SMTP email

```ts
import { SmtpEmailAdapter } from "./shared/infrastructure/email/SmtpEmailAdapter.ts";
import { ConsoleEmailAdapter } from "./shared/infrastructure/email/ConsoleEmailAdapter.ts";

const smtp = SmtpEmailAdapter.createFromEnv(process.env, logger);
const email: EmailPort = smtp ?? new ConsoleEmailAdapter(logger);
```

`createFromEnv` returns `undefined` when `SMTP_HOST` or `SMTP_FROM_ADDRESS` is missing —
the fallback to `ConsoleEmailAdapter` keeps dev frictionless. See [`.env.example`](.env.example).

### Process-level error trapping

```ts
import { ErrorHandler } from "./shared/infrastructure/alerts/ErrorHandler.ts";
import { ConsoleAlertAdapter } from "./shared/infrastructure/alerts/ConsoleAlertAdapter.ts";

new ErrorHandler(new ConsoleAlertAdapter()).register();
// traps uncaughtException + unhandledRejection
```

### TLS

Set `TLS_CERT_PATH` and `TLS_KEY_PATH`; use `TlsConfig.fromEnv()` and pass to your `https.createServer` wrapper.

### Pagination

```ts
import {
  createPaginatedRequest,
  createPaginatedResponse,
} from "./shared/application/Pagination.ts";

const req = createPaginatedRequest(query.page, query.pageSize); // page≥1, pageSize 1–100
const res = createPaginatedResponse(items, total, req);
// → { items, total, page, pageSize, totalPages }
```

### Correlation IDs

Active by default. Every request gets one (from header `X-Correlation-Id` or generated).
`ConsoleLogger` emits it automatically:

```bash
curl -H "X-Correlation-Id: req-abc" http://localhost:3000/users -d '...'
# logs: {"level":"info","message":"...","correlationId":"req-abc",...}
```

## Switching databases

Default is SQLite for zero-friction local dev. To switch to Postgres:

1. `npm i @mikro-orm/postgresql && npm un @mikro-orm/sqlite`
2. In `src/mikro-orm.config.ts`: `import { defineConfig } from "@mikro-orm/postgresql"`
3. In `src/shared/factories/index.ts`: `import { MikroORM } from "@mikro-orm/postgresql"`
4. Set DB env vars and update `defineConfig({ host, port, dbName, user, password })`

Migrations are portable — they use `this.addSql()` and MikroORM's QB.

## Production checklist

Before deploying:

- [ ] Configure database via env (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`) and the appropriate driver
- [ ] Add your auth layer — this template intentionally has none (BYO JWT/Auth0/Cognito)
- [ ] Configure SMTP via `SmtpEmailAdapter.createFromEnv` or replace with your provider
- [ ] Wire `ErrorHandler` in `main.ts` to capture `uncaughtException` / `unhandledRejection`
- [ ] Point your orchestrator's probes at `/health/live` and `/health/ready`
- [ ] Forward stdout to your log aggregator — logs are JSON with `correlationId`
- [ ] If multi-tenant, add the `CompanyFilter` to every tenant-scoped `EntitySchema`
- [ ] Replace `NoOpSseBroadcaster` decision (keep SSE if you need real-time)
- [ ] CI is in `.github/workflows/ci.yml` — wire branch protection to require it

## What's intentionally NOT included

These are deliberate omissions to keep the template focused. Drop in your preferred libraries when you need them.

- **Authentication / Authorization** — every project has its own provider (Auth0, Cognito, custom JWT, session). The template ships `TenantContext` and `CorrelationIdMiddleware`, so plug your auth into the request pipeline and call `runWithTenant(companyId, ...)`.
- **Cache / Redis** — add when you measure a need.
- **Rate limiting** — handle at the gateway/proxy layer or add `express-rate-limit`-equivalent middleware.
- **OpenTelemetry** — `correlationId` is the foundation; wire OTel exporters in `ConsoleLogger` if needed.
- **Validation library** (Zod / Valibot) — VO constructors do invariant validation by design. Add a schema lib only at the HTTP edge if you want.
- **Postgres by default** — SQLite keeps `npm install && npm start` working with zero infrastructure.

## Architecture deep-dive

For the full request lifecycle (diagram + step-by-step), see
**[docs/architecture.md](docs/architecture.md)**.

For the rationale behind each major decision, see the **[ADRs](docs/adrs/)**.

## AI-assisted development

This template ships **fully wired AI tooling** so any agent (Claude Code, Cursor,
Codex CLI, Cline, Aider, Continue, Copilot Chat, Windsurf) starts contributing
correctly the moment you clone — no setup, no prompt engineering required.

### What ships

- [`.claude/skills/`](.claude/skills/) — **13 engineering skills** in Ring format. **Single source of truth** for every rule. Read natively by Claude Code.
- [`.cursor/rules/`](.cursor/rules/), [`.windsurf/rules/`](.windsurf/rules/), [`.clinerules/`](.clinerules/), [`.continue/rules/`](.continue/rules/), [`CONVENTIONS.md`](CONVENTIONS.md) — **auto-generated adapters** for every other assistant. Regenerated by `npm run sync:rules` (runs automatically on `npm install`). Never edit manually.
- [`AGENTS.md`](AGENTS.md) — generic, tool-agnostic instruction file. Read by Codex CLI, Zed, generic agents.
- [`CLAUDE.md`](CLAUDE.md) — concise reference (conventions, TS constraints, test patterns). Read natively by Claude Code.
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — instructions for GitHub Copilot Chat.
- [`.claude/hooks/`](.claude/hooks/) — **9 deterministic hooks** in pure Node ESM. Run interactively in Claude Code via [`.claude/settings.json`](.claude/settings.json); the same checks also run as a **git pre-commit hook** (auto-installed by `npm install`) so every commit — Cursor, Copilot, manual, CI — is enforced.

**Strategy:** see [ADR-007](docs/adrs/007-multi-assistant-rules-strategy.md). One `.claude/skills/` directory feeds every adapter; pre-commit is the deterministic safety net.

### Skills overview

| Category | Skills |
| -------- | ------ |
| **Onboarding** (template-specific) | `project-onboarding`, `architecture-explainer`, `module-walkthrough` |
| **Always-on** | `adr`, `readable-code`, `doc-sync` |
| **Workflow** | `tdd-workflow`, `safe-refactoring` |
| **Architecture** | `ddd-patterns`, `hexagonal-architecture` |
| **Delivery** | `pr-template`, `code-review`, `task-breakdown` |

The three onboarding skills are the differentiator: any agent on a fresh clone can
take a guided tour (`project-onboarding`), explain any architectural pattern with
file references (`architecture-explainer`), or walk a dev step-by-step through
adding a new bounded context, aggregate, use case, or domain event (`module-walkthrough`).

### Hooks overview

The validation logic lives in [`.claude/hooks/checks/`](.claude/hooks/checks/) as pure Node functions and is consumed by **two thin runners**:

1. **Claude Code runtime hooks** — interactive, real-time. Wired in [`.claude/settings.json`](.claude/settings.json), trigger on `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop`.
2. **Git pre-commit hook** — runs for every commit, regardless of which agent (or no agent) made the changes. Auto-installed by `npm install` via [`scripts/install-git-hooks.mjs`](scripts/install-git-hooks.mjs).

| Hook                              | Catches                                                                | Runs in                |
| --------------------------------- | ---------------------------------------------------------------------- | ---------------------- |
| `tdd-checker.mjs`                 | Production code written without a co-located `.test.ts`                | Claude Code + commit   |
| `hexagonal-validator.mjs`         | Domain or application code importing from infrastructure or MikroORM   | Claude Code + commit   |
| `plainobject-checker.mjs`         | ORM entity written without `extends PlainObject` (the #1 footgun)      | Claude Code + commit   |
| `readable-code-checker.mjs`       | Magic numbers, nested ternaries, long functional chains                | Claude Code + commit (warn) |
| `safe-refactoring-checker.mjs`    | Direct edits on `refactor/*` branches (suggests parallel implementation) | Claude Code            |
| `adr-detector.mjs`                | Architectural keywords in user prompt without ADR consultation         | Claude Code            |
| `pr-template-validator.mjs`       | `gh pr create` with body missing Summary or Test plan                  | Claude Code            |
| `doc-sync-tracker.mjs` + `doc-sync-checker.mjs` | Code changed in session but no docs/ADR updated          | Claude Code            |

**Requirement:** Node 24+ in PATH (already required by the project). No PowerShell, no extra binaries, no env vars.

### How it works for each tool

| Assistant | Reads | Notes |
| --- | --- | --- |
| **Claude Code** | `.claude/skills/`, `.claude/settings.json` (hooks), `CLAUDE.md` | Native — interactive hooks fire during session |
| **Cursor** | `.cursor/rules/*.mdc` | Auto-generated; `alwaysApply` for non-negotiable rules |
| **Windsurf** | `.windsurf/rules/*.md` | Auto-generated; `trigger: always_on` for critical rules |
| **Cline** | `.clinerules/*.md` | Auto-generated |
| **Continue** | `.continue/rules/*.md` | Auto-generated |
| **Aider** | `CONVENTIONS.md` | Auto-generated, single consolidated file |
| **GitHub Copilot** | `.github/copilot-instructions.md` | Manual (stable) |
| **Codex CLI / Zed / generic** | `AGENTS.md` | Manual (stable) |
| **Any other / manual / CI** | git pre-commit hook | Deterministic safety net for every commit |

```bash
npm run sync:rules       # regenerates all adapters from .claude/skills/
npm run hooks:test       # 20 smoke tests for the Claude Code runtime hooks
npm run hooks:install    # re-install the git pre-commit hook (also runs on `npm install`)
npm run precommit        # run pre-commit checks against currently staged files
```

### Verifying rules are loaded in your assistant

After cloning, confirm the assistant is honoring the rules — not just reading the files.

**Cursor:**
- Open `Settings → Rules` (Cursor settings, not VSCode). You should see 13 entries from `.cursor/rules/`.
- Three rules are `alwaysApply: true` (always-on): `adr`, `readable-code`, `doc-sync`.
- Make sure you're in **Agent mode** (not Ask). Rules are most active in Agent.
- Quick sanity prompt: ask "What rules are currently active?" — Cursor should list them.
- If rules don't appear: reload window (`Ctrl+Shift+P → Reload Window`) and ensure the project root is the workspace root (not a parent folder).

**Windsurf:**
- Cascade panel → top-right gear → Memories & Rules. The 13 rules appear as workspace rules with their trigger types.
- Three rules are `trigger: always_on`. The rest activate by glob or model decision.

**Cline / Continue:**
- Both auto-load from `.clinerules/` and `.continue/rules/` respectively. No manual step.
- Cline shows active rules in the chat header.

**Aider:**
- Pass `--read CONVENTIONS.md` on the CLI, or add to `.aider.conf.yml`:
  ```yaml
  read: CONVENTIONS.md
  ```

**Claude Code:**
- Skills auto-discovered from `.claude/skills/`. Hooks wired via `.claude/settings.json`. Zero setup.

**Re-sync after editing skills:**
```bash
npm run sync:rules    # regenerates all adapters
```

The `prepare` script also regenerates on every `npm install`, so a fresh clone is always in sync.

### Optional: install globally

The tooling is project-local by default. To install the same skills/hooks at
`~/.claude/` so they apply to every project on your machine (cross-platform):

```bash
node scripts/setup-ai.mjs            # install globally
node scripts/setup-ai.mjs --verify   # dry-run
# or
npm run setup:ai
```

Single Node script, runs identically on Windows, macOS and Linux.

## License

ISC
