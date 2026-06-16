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
| **Actor** | Quem originou uma ação: um `User` (humano) ou uma `ConsumerCredential` (máquina). |
| **Audit Trail** | Visão de leitura, isolada por tenant, de tudo que aconteceu: quem fez o quê, quando, em qual organização. |

## 5. Modelo de domínio

Este PRD não cria agregado de negócio — ele garante uma propriedade transversal: **todo registro de evento responde quem fez e em qual tenant**, e nenhum evento sai carimbado com o tenant errado.

> O contrato do envelope de evento e a regra de preenchimento (incluindo a trava fail-closed que impede carimbo cross-tenant) são decididos na **ADR-008**. A persistência desses campos e o filtro por tenant no log são decididos na **ADR-009**.

## 6. Domain Events
Nenhum evento de negócio novo. O que muda é o **envelope** de todos os eventos.

## 7. Capacidades
- **Enriquecimento automático:** toda ação registrada já sai com quem a originou e em qual tenant, sem o autor de cada feature precisar se preocupar com isso (mecanismo → ADR-008).
- **Consulta de auditoria:** o Auditor lista o que aconteceu na sua organização, filtrando por agregado, ator, intervalo de tempo e tipo de evento — sempre restrito ao seu tenant.

## 8. Contratos
- A superfície REST/MCP da auditoria é detalhada no PRD-5/PRD-6. Aqui fica apenas a promessa: existe uma leitura de auditoria isolada por tenant.

## 9. Persistência
- Decisões de persistência (colunas do log de eventos, índices, filtro por tenant e convenção para novas schemas tenant-scoped) → **ADR-009**.

## 10. Critérios de aceite
- [ ] Toda ação registrada identifica quem a originou e em qual organização.
- [ ] Um auditor **nunca** vê eventos de outra organização (teste de isolamento com 2 tenants).
- [ ] Ler ou gravar dado de um tenant sem um tenant ativo (e fora de escopo privilegiado) **falha de forma barulhenta** — nunca retorna vazio nem dado de outro tenant.
- [ ] Uma gravação que tente cruzar tenant (agregado de um tenant sob contexto de outro) é abortada antes de persistir.
- [ ] Ações de operador são registradas e ficam fora da visão de auditoria de tenant.

## 11. Dependências e ordem
- **Pré-requisito de PRD-1..6.** Deve ser o primeiro a entrar.

## 12. Riscos & ADRs
- **ADR-008 — Actor Context & Event Envelope Enrichment** (escrita): como propagamos o ator e por que carimbamos a partir do contexto com cross-check fail-closed contra o agregado.
- **ADR-009 — Tenancy Isolation Guarantees** (escrita): onde o filtro é aplicado, o que acontece em contexto sem tenant, e o buraco do caminho de escrita do MikroORM. Resolve também o enum final de `actorType` e o tratamento do operador.
- **Risco:** crescimento de `system_events` (archival/retenção) — dívida registrada para ADR futura, fora da v1.
