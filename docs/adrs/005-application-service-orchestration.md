# ADR-005: Application Service Orchestration

## Status

Aceita

## Contexto

Use Cases executam logica de dominio, mas nao devem gerenciar transacoes, dispatch de eventos
ou publicacao externa. Um orquestrador e necessario para coordenar essas responsabilidades.

## Decisao

Criar `ApplicationService` como orquestrador generico que coordena o ciclo completo.

**Ciclo de execucao:**

```
1. unitOfWork.begin()
2. useCase.execute(command) -> { result, aggregates }
3. aggregate.drainDomainEvents() -> coleta eventos
4. domainEventManager.dispatchAll(events) -> handlers in-process
5. eventPublisher.publishAll(events) -> publicacao externa
6. unitOfWork.commit()
7. Em caso de erro: unitOfWork.rollback() + re-throw
```

**Design do UseCaseResult:**

```typescript
interface UseCaseResult<Result> {
  result: Result; // valor retornado ao caller
  aggregates: AggregateRoot[]; // agregados para drenagem de eventos
}
```

O UseCase retorna `UseCaseResult` para que o ApplicationService possa drenar eventos dos
agregados automaticamente, sem que o UseCase precise se preocupar com dispatch.

**Responsabilidades:**
| Componente | Responsabilidade |
|-----------|-----------------|
| UseCase | Logica de dominio + persistencia |
| ApplicationService | Transacao + dispatch + publish |
| DomainEventManager | Handlers in-process |
| EventPublisher | Publicacao externa |
| UnitOfWork | Controle transacional |

## Consequencias

**Positivas:**

- Use Cases focam apenas em logica de dominio
- Transacoes, eventos e publicacao sao automaticos
- Padrao consistente para todas as operacoes
- Facil de testar cada componente isoladamente

**Negativas:**

- Todo UseCase precisa retornar `UseCaseResult` (incluindo agregados)
- ApplicationService adiciona uma camada de indireção
