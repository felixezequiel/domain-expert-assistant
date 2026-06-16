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

## Emenda — Propriedade do flush e da transação (consistência)

A decisão original já dizia "sem `repository.save()` manual": o agregado se auto-rastreia e o
`ApplicationService` comita. O que estava **inconsistente** era *quem dá `flush`* — alguns
repositórios MikroORM faziam `upsert` + `flush()` por chamada, enquanto os persisters e o version
store não. Esta emenda fecha a regra.

**Regra:** nenhum repositório chama `flush()`. O `flush`/commit é **exclusivo do
`MikroOrmUnitOfWork.onCommit`**, que envolve os persisters em `em.transactional(...)` — um único
flush por use case. Em MikroORM v7 esse `transactional()` dá flush em **toda a unit of work do
EM** (eventos do event store + agregados + qualquer `persist()` staged) numa só transação — é o
que a ADR-006 exige (eventos dentro da transação do agregado) e o que o teste de integração de
auditoria comprova.

**Como cada escrita participa do commit único:**

| Tipo de escrita | Mecanismo | Por quê |
|---|---|---|
| Agregado mutável (User, Organization, ConsumerCredential, KnowledgeItem, Collection, Tag) | persister faz `em.upsert(...)` **dentro** do `transactional` do `onCommit`, alcançado pelo tracking | `upsert` executa na hora; só é atômico dentro da transação aberta no commit |
| Insert-only / append-only (event store, KnowledgeVersion, Session) | repositório faz `em.persist(...)` (stage), **sem flush** | `persist` é deferido; o flush do `onCommit` o comita junto, atômico |
| Leituras | `findOne`/`find` diretos no use case | filtradas pelo `CompanyFilter` que o `onBegin` arma |

**Para quem adiciona um agregado ou contexto:**

- Agregado mutável → **registre um `AggregatePersister`** no wiring do módulo. Identity e Knowledge
  já o fazem (`<context>/factories/index.ts`). **Não** chame `repo.save()` dentro do `execute()`
  para persistir um agregado mutável: o `upsert` rodaria fora da transação (autocommit imediato,
  não atômico). O `save()` dos repositórios de agregado existe só para o contrato da porta/testes —
  o write path de produção é o persister.
- Escrita insert-only fora do tracking (ex.: Session) → `em.persist(...)` no repositório, nunca
  `flush()`.

**Transação no `onBegin` (task #8 — implementado).** O `onBegin` agora abre uma transação
(read-write por padrão) que envolve o use case inteiro: leituras e escritas rodam dentro dela, o
event store é gravado nela, e o `onCommit` dá `flush` + `commit` (ou `rollback` no erro). Isso
fecha a brecha do `upsert` imediato fora de transação e é o seam que o RLS precisa — uma transação
onde dar `SET LOCAL` do tenant. A resolução do escopo de tenant roda **antes** do `begin()` para
que um throw fail-closed nunca deixe transação aberta.

**READ ONLY não é responsabilidade do use case.** Modo de transação é preocupação de camada
externa, não do caso de uso — então o use case não carrega flag de leitura/escrita. A UoW expõe
`begin(readOnly = false)` como seam para a **borda** decidir (ex.: HTTP GET → READ ONLY) quando/se
valer a pena; o default é read-write. READ ONLY é só otimização — o RLS **não** depende dele (depende
da transação, que já existe).

**Falta para o RLS completo (task #8):** `SET LOCAL app.current_company` no `onBegin` + migration
habilitando `ENABLE ROW LEVEL SECURITY` e as políticas nas tabelas tenant + garantir que toda
leitura passe pela UoW (hoje algumas leituras chamam `useCase.execute()` direto, fora da transação).
