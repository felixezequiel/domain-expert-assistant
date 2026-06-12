# ADR-006: Event Store, Causation Tracking e Patterns de Producao

## Status

Aceita

## Contexto

O template recebeu criticas de que nao resolvia problemas reais da vida real, como:

- **Desacoplamento real entre persistencia e dominio** — o dominio emitia eventos mas nao havia infraestrutura para persisti-los de forma independente do ORM
- **Rastreabilidade de eventos** — sem forma de saber qual evento causou qual acao (causation chain)
- **Adapters de infraestrutura como fontes de eventos** — adapters secundarios (email, messaging) nao podiam emitir domain events
- **Composicao de modulos** — a composicao de dependencias era manual e espalhada no main.ts
- **Testabilidade de integracao** — faltavam repositorios in-memory e unit of work para testes sem banco de dados

Essas limitacoes faziam o template parecer um exercicio academico em vez de uma base para projetos reais.

## Decisao

Implementar um conjunto de patterns que resolvem problemas concretos de producao:

### 1. Event Store (Event Sourcing Light)

Persistencia automatica de todos os domain events em tabela dedicada (`system_events`).

```
system_events
├── id            TEXT PK    — UUID do evento
├── event_name    TEXT       — nome do evento (ex: "UserCreated")
├── aggregate_id  TEXT       — ID do agregado que emitiu
├── occurred_at   TEXT       — timestamp ISO
├── payload       TEXT       — JSON completo do evento
└── causation_id  TEXT       — ID do evento que causou este (nullable)
```

**Componentes:**

- `EventStorePort` — interface no shared/ports (dominio nao conhece implementacao)
- `MikroOrmEventStore` — implementacao com MikroORM que serializa eventos em JSON
- `NoOpEventStore` — implementacao no-op para benchmarks e testes

**Pipeline no ApplicationService:**

```
begin → execute → drain events → dispatch(sync) → publish(async) → saveAll(eventStore) → commit
```

### 2. Causation Tracking

Todo `DomainEvent` agora possui:

- `eventId` — identificador unico do evento
- `causationId` — referencia ao evento que originou esta acao

**Exemplo real de cadeia de eventos:**

```
UserCreatedEvent (eventId: "abc-123", causationId: null)
  └── WelcomeEmailSentEvent (eventId: "def-456", causationId: "abc-123")
```

Quando o handler de `UserCreated` dispara `SendWelcomeEmail`, o command carrega o `eventId` original como `causationId`. O evento resultante (`WelcomeEmailSent`) referencia sua causa.

Isso permite reconstruir a arvore completa de eventos a partir de qualquer ponto.

### 3. EventEmittingAdapter

Base class para adapters de infraestrutura que precisam emitir domain events sem serem aggregates.

```typescript
abstract class EventEmittingAdapter implements DomainEventEmitter {
  protected addDomainEvent(event: DomainEvent): void;
  getDomainEvents(): ReadonlyArray<DomainEvent>;
  drainDomainEvents(): ReadonlyArray<DomainEvent>;
}
```

**Caso real:** `ConsoleEmailNotification` estende `EventEmittingAdapter` e emite `WelcomeEmailSentEvent` ou `WelcomeEmailFailedEvent` dependendo do resultado do envio.

O `AggregateTracker` agora rastreia qualquer `DomainEventEmitter`, nao apenas `AggregateRoot`. Adapters que emitem eventos sao automaticamente rastreados e seus eventos sao drenados pelo `ApplicationService`.

### 4. AggregatePersister Pattern

Interface polimorfca que permite ao `MikroOrmUnitOfWork` persistir diferentes tipos de agregados sem conhece-los diretamente.

```typescript
interface AggregatePersister {
  supports(aggregate: AggregateRoot): boolean;
  persist(aggregate: AggregateRoot, entityManager: EntityManager): void;
}
```

Cada modulo fornece seus persisters. O UnitOfWork delega para o persister correto baseado no tipo do agregado.

**MikroOrmAggregatePersister** — implementacao generica configuravel:

- Classe do agregado que suporta
- Classe da entidade ORM
- Mapper agregado → entidade ORM
- Suporte a entidades aninhadas (ex: User → Addresses)

### 5. Factory Pattern para Composicao

Factories centralizam a criacao de infraestrutura:

- `DatabaseFactory` — inicializa MikroORM e configura callbacks de tracking
- `InfrastructureFactory` — monta toda infraestrutura (UoW, EventBus, ApplicationService, servers)
- `UserModuleFactory` — cada modulo declara seus persisters e registra rotas/handlers

Resultado: `main.ts` reduzido a poucas linhas de composicao.

### 6. Multiplas Implementacoes de UnitOfWork

| Implementacao        | Uso        | Comportamento                                |
| -------------------- | ---------- | -------------------------------------------- |
| `MikroOrmUnitOfWork` | Producao   | Fork EM, persist via persisters, flush       |
| `InMemoryUnitOfWork` | Testes     | Rotas aggregates para repositorios in-memory |
| `NoOpUnitOfWork`     | Benchmarks | Todas as operacoes sao no-ops                |

### 7. InMemoryUserRepository

Repositorio in-memory completo para testes de integracao sem banco de dados. Implementa `UserRepositoryPort` com `Map<string, User>` internamente.

## Consequencias

**Positivas:**

- Auditoria completa — todo evento de dominio e persistido com payload e timestamp
- Rastreabilidade — causation chains permitem reconstruir fluxos completos
- Adapters como fontes de eventos — email, messaging, etc. emitem eventos rastreados
- Testabilidade — testes de integracao rodam sem banco real
- Composicao declarativa — factories centralizam wiring de dependencias
- Persistencia desacoplada — dominio nao sabe nada sobre ORM, apenas define ports
- Extensibilidade — novos modulos so precisam fornecer persisters e factories

**Negativas:**

- Tabela de eventos cresce com o tempo (necessario estrategia de archival em producao)
- Serializar eventos como JSON perde type safety na leitura (deserializacao manual)
- Mais abstrações para devs novos entenderem

## Notas

Este conjunto de mudancas endereca diretamente a critica de que o template era "academico demais":

1. **Event Store** resolve o problema real de auditoria e compliance
2. **Causation Tracking** resolve debugging de fluxos assincronos em producao
3. **EventEmittingAdapter** resolve o gap de adapters que precisam reportar resultados como eventos
4. **AggregatePersister** resolve o desacoplamento real entre dominio e ORM
5. **Factories** resolvem a composicao de modulos em monolitos modulares
6. **InMemoryUnitOfWork** resolve testabilidade sem dependencias externas

Cada pattern foi implementado com testes unitarios e de integracao, incluindo testes de cadeia completa (criar usuario → enviar email → rastrear eventos com causation).
