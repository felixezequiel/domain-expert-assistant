# ADR-004: Unit of Work Pattern

## Status

Aceita

## Contexto

Operacoes de dominio frequentemente envolvem multiplas escritas que devem ser atomicas.
O padrao Unit of Work gerencia transacoes de forma explicita.

## Decisao

Definir `UnitOfWork` como interface (port) no shared kernel.

```typescript
interface UnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
```

**Orquestracao pelo ApplicationService:**

1. `begin()` antes de executar o use case
2. `commit()` apos use case + dispatch + publish
3. `rollback()` em caso de erro em qualquer etapa

**Implementacao:**

- A interface e pura (dominio nao conhece detalhes de transacao)
- Cada adapter de infraestrutura implementa conforme sua tecnologia:
  - SQL: transacoes do banco
  - In-memory: no-op (para testes)
  - Distributed: sagas ou outbox pattern

## Consequencias

**Positivas:**

- Transacoes explicitas e controladas
- Dominio desacoplado de mecanismo de transacao
- Facil de mockar em testes unitarios
- ApplicationService garante consistencia automaticamente

**Negativas:**

- Requer que todo adapter de persistencia suporte transacoes
- Nao resolve transacoes distribuidas nativamente
