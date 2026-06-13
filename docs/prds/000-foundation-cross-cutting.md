# PRD-0: Foundation & Cross-cutting

| Campo    | Valor                                          |
| -------- | ---------------------------------------------- |
| Status   | Proposto                                       |
| Fase     | v1 — pré-requisito de todos os demais PRDs     |
| Contexto | Shared Kernel / Tenancy / Audit                |
| Depende de | (nada — é a base)                            |

## 1. Objetivo & valor

Preparar o template para um produto **multi-tenant** e **auditável** de verdade, fechando as lacunas que os demais PRDs assumem como prontas. Não entrega funcionalidade de usuário final; entrega o **alicerce transversal** que torna correto tudo que vem depois.

Três entregas centrais:

1. **Isolamento multi-tenant garantido por construção** — nenhum dado de um tenant vaza para outro, em qualquer caminho (HTTP, MCP, tarefas internas).
2. **Domain events que respondem "quem fez, em qual tenant"** — hoje o evento sabe *o quê* e *quando*, mas não *quem* nem *de qual organização*.
3. **Event store como trilha de auditoria** isolada por tenant, atendendo a persona **Auditor** e a governança.

## 2. Escopo

**Inclui:**
- Enriquecer o contrato `DomainEvent` com `actorId` e `companyId` (envelope de evento).
- Adicionar `company_id` (e `actor_id`) à tabela `system_events` e aplicar o `CompanyFilter`.
- Propagar o **ator atual** (humano ou credencial de consumidor) via contexto assíncrono, análogo ao `TenantContext`.
- Garantir que `MikroOrmUnitOfWork.onBegin()` injeta os filtros de tenant em todas as queries.
- Convenção e helpers para que **toda nova EntitySchema tenant-scoped** inclua o filtro e a coluna `company_id`.
- Consulta de auditoria base (read model): listar eventos de um tenant por agregado/intervalo/ator.

**Não inclui (fora da v1):**
- Log de consumo / read-side audit (quais queries cada consumidor fez).
- Estratégia de archival/retenção do `system_events` (registrar como risco/ADR futuro).
- Notificações a partir de eventos.

## 3. Personas envolvidas
- **Auditor** (consome a trilha de auditoria — leitura).
- Indireta: todas as outras, pois todo agregado passa a carregar tenant + ator.

## 4. Linguagem ubíqua (novos termos)
| Termo | Significado |
|---|---|
| **Actor** | Quem originou uma ação: um `User` (humano) ou uma `ConsumerCredential` (máquina). Identificado por `actorId` + `actorType`. |
| **Actor Context** | Contexto assíncrono (AsyncLocalStorage) que carrega o ator atual durante a execução de um caso de uso. |
| **Audit Trail** | Visão de leitura sobre `system_events`, isolada por tenant. |

## 5. Modelo de domínio

Este PRD mexe em **infraestrutura compartilhada**, não cria agregado novo. Alterações:

### `DomainEvent` (contrato)
```
DomainEvent {
  eventId: string
  eventName: string
  occurredAt: Date
  aggregateId: string
  causationId: string | null
  companyId: string | null      // NOVO — tenant que originou
  actorId: string | null        // NOVO — quem originou
  actorType: 'user' | 'consumer' | 'system' | null   // NOVO
}
```
> `null` permitido para ações de sistema/migração e rotas públicas (ex.: provisionamento de tenant pelo operador).

### `SystemEventEntity` / `system_events`
Acrescentar colunas `company_id`, `actor_id`, `actor_type`. Aplicar `companyTenantFilterDefinition` no `SystemEventEntitySchema`. Índices em `(company_id, occurred_at)` e `(company_id, aggregate_id)`.

### Invariantes
- Todo evento emitido **dentro de um Actor Context** preenche `companyId` e `actorId` automaticamente (preenchidos no momento do drain, não pelo agregado).
- Em produção, eventos de agregados tenant-scoped **devem** ter `companyId` não-nulo (validação no `ApplicationService`/event store em modo estrito).

## 6. Domain Events
Nenhum evento de negócio novo. O que muda é o **envelope** de todos os eventos.

## 7. Casos de uso / mudanças de orquestração
- **Enriquecimento no drain:** `ApplicationService.executeInScope`, ao drenar os eventos, carimba `companyId` (de `getCurrentCompanyId()`) e `actorId`/`actorType` (de um novo `getCurrentActor()`) nos eventos que ainda não os têm.
- **Query de auditoria:** `ListAuditEventsQuery(companyId, { aggregateId?, actorId?, from?, to?, eventName?, page })` → página de eventos. Read-only, sempre filtrado por tenant.

## 8. Contratos
- (REST/MCP de auditoria detalhados no PRD-5/PRD-6.) Aqui definimos só o **query model** interno `AuditTrailQueryService`.

## 9. Persistência
- Migração MikroORM: `ALTER TABLE system_events ADD company_id, actor_id, actor_type` + índices.
- Helper `tenantScopedSchema(...)` ou checklist documentado: toda nova schema tenant-scoped inclui `company_id` + filtro.

## 10. Critérios de aceite
- [ ] Um evento emitido por um caso de uso dentro de um `runWithTenant` + `runWithActor` chega ao `system_events` com `company_id` e `actor_id` corretos.
- [ ] Query de auditoria de um tenant **nunca** retorna eventos de outro tenant (teste de isolamento com 2 tenants).
- [ ] Tentar persistir um agregado tenant-scoped fora de um Actor/Tenant context falha (ou loga aviso em modo não-estrito) — comportamento definido e testado.
- [ ] `CompanyFilter` aplicado em `system_events` (query sem tenant retorna vazio/erro conforme política).
- [ ] Testes de integração in-memory cobrindo enriquecimento de evento e isolamento.

## 11. Dependências e ordem
- **Pré-requisito de PRD-1..6.** Deve ser o primeiro a entrar.

## 12. Riscos & ADRs a criar
- **ADR:** "Actor Context & Event Envelope Enrichment" — como propagamos ator e por que carimbamos no drain (e não no agregado).
- **ADR:** "Tenancy Isolation Guarantees" — onde o filtro é aplicado e o que acontece em contextos sem tenant.
- **Risco:** crescimento de `system_events` (archival) — registrar como dívida com ADR futuro.
- **Decisão em aberto:** `actorType` enum final (incluir `'system'` para jobs/migrações).
