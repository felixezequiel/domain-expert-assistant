# Architecture

DDD with Hexagonal Architecture (Ports & Adapters). Dependencies point inward:
**infrastructure → application → domain**. Domain never imports from outer layers.

## End-to-end request flow

```mermaid
graph TB
    subgraph INFRA_IN ["Infrastructure · Primary Adapters"]
        REST["REST Controller"]
        GQL["GraphQL Resolver"]
    end

    subgraph APP ["Application Layer"]
        AS["ApplicationService
        ─────────────────
        execute(useCase, command)"]

        UC["UseCase
        ─────────────
        execute(command) → T"]

        DEM["DomainEventManager
        ────────────────────
        dispatchAll(events)"]
    end

    subgraph DOMAIN ["Domain Layer"]
        AR["AggregateRoot
        ────────────────
        addDomainEvent(event)
        drainDomainEvents()
        markForDeletion()
        setOnTrack(callback)"]

        EV["DomainEvent"]
    end

    subgraph TRACKING ["Tracking · AsyncLocalStorage"]
        AT["AggregateTracker
        ──────────────────
        begin() → push Set
        track(aggregate) → Set.add
        peek() → read Set
        drain() → pop Set
        clear() → discard Set"]
    end

    subgraph PERSISTENCE ["Persistence Infrastructure"]
        UOW_IF{{"«interface»
        UnitOfWork"}}

        TUOW["TrackedUnitOfWork
        ─────────────────────
        begin → AT.begin + onBegin
        commit → AT.drain + onCommit
        rollback → AT.clear + onRollback"]

        MIKRO["MikroOrmUnitOfWork
        ──────────────────────
        onBegin: fork EM + tenant filter
        onCommit: em.transactional()
          → persist | delete
        onRollback: clear EM"]

        INMEM["InMemoryUnitOfWork
        ──────────────────────
        onCommit: save | delete via
        repository adapters"]

        NOOP["NoOpUnitOfWork
        ─────────────────
        all no-ops (benchmarks)"]

        PERS{{"«interface»
        AggregatePersister
        ───────────────────
        supports(aggregate)
        persist(aggregate, em)
        delete(aggregate, em)"}}

        EP{{"«interface»
        EventPublisherPort
        ───────────────────
        publishAll(events)"}}

        ES{{"«interface»
        EventStorePort
        ───────────────────
        saveAll(events)"}}

        SSE{{"«interface»
        SseBroadcasterPort
        ───────────────────
        broadcastAll(events)"}}
    end

    REST --> AS
    GQL --> AS

    AS -- "1. begin()" --> UOW_IF
    AS -- "2. execute(command)" --> UC
    UC -- "create / mutate" --> AR
    AR -. "auto-track on first event" .-> AT
    AR -- "produces" --> EV
    AS -- "3. drainDomainEvents()" --> AR
    AS -- "4. dispatchAll (in-process)" --> DEM
    AS -- "5. publishAll (external)" --> EP
    AS -- "6. saveAll (event store)" --> ES
    AS -- "7. commit()" --> UOW_IF
    AS -- "8. broadcastAll (post-commit)" --> SSE

    UOW_IF -.- TUOW
    TUOW --> AT
    TUOW -.- MIKRO
    TUOW -.- INMEM
    TUOW -.- NOOP
    MIKRO --> PERS

    style INFRA_IN fill:#E8EAF6,stroke:#3F51B5,color:#1A237E
    style APP fill:#E3F2FD,stroke:#1565C0,color:#0D47A1
    style DOMAIN fill:#E8F5E9,stroke:#2E7D32,color:#1B5E20
    style TRACKING fill:#FFF3E0,stroke:#E65100,color:#BF360C
    style PERSISTENCE fill:#F3E5F5,stroke:#7B1FA2,color:#4A148C
```

## Step-by-step

1. **Startup** — `AggregateRoot.setOnTrack(callback)` wires a global callback that calls `AggregateTracker.track(aggregate)` (done by `DatabaseFactory`).
2. **`begin()`** — `TrackedUnitOfWork` calls `AggregateTracker.begin()`, pushing a new `Set` onto a stack scoped to the current async context via `AsyncLocalStorage`. `MikroOrmUnitOfWork.onBegin()` additionally forks the EntityManager and applies the tenant filter when a tenant context is active.
3. **Use case** — When `aggregate.addDomainEvent(event)` is called, the aggregate auto-registers itself in the current scope (once per drain cycle). Aggregates can also call `markForDeletion()`.
4. **Drain & dispatch** — `ApplicationService` peeks at tracked aggregates, drains their domain events, dispatches in-process via `DomainEventManager`, publishes externally via `EventPublisherPort`, persists to the event store via `EventStorePort`.
5. **`commit()`** — `TrackedUnitOfWork` drains the scope and passes the aggregates to `onCommit()`. `MikroOrmUnitOfWork` wraps the work in `em.transactional()`, routing each aggregate to its `AggregatePersister` (calling `persist()` or `delete()` depending on `isMarkedForDeletion()`).
6. **`rollback()`** — `AggregateTracker.clear()` discards the current scope; the concrete UoW cleans up (e.g. `em.clear()`).
7. **Post-commit** — `ApplicationService` calls `sseBroadcaster.broadcastAll(events)` outside the try/catch (fire-and-forget).
8. **Nested scopes** — Stack-based design supports nested `begin()`/`commit()` within the same async context.

## Why this shape

- **Aggregates auto-track themselves** so use cases stay focused on domain logic — no manual return of aggregates, no `repository.save()` calls.
- **`AsyncLocalStorage`** isolates per-request state (tenant id, correlation id, EntityManager scope, tracked aggregates) without threading parameters through every layer.
- **`em.transactional()` on commit** ensures aggregate state, child entities, deletes, and event-store records are flushed atomically.
- **Event store inside the same transaction as aggregates** — events and aggregate writes commit together or roll back together (no dual-write divergence).
- **SSE broadcast _after_ commit** — external observers only see committed state.

See [ADRs](adrs/) for the long-form rationale of each decision.
