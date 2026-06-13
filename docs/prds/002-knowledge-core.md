# PRD-2: Knowledge Core

| Campo      | Valor                          |
| ---------- | ------------------------------ |
| Status     | Proposto                       |
| Fase       | v1 — **CORE DOMAIN**           |
| Contexto   | Knowledge                      |
| Depende de | PRD-0, PRD-1                   |

## 1. Objetivo & valor

O coração do produto: representar, **governar** e versionar a *verdade do domínio de negócio* do cliente. Aqui vive o agregado que tudo mais serve (`KnowledgeItem`), a fronteira de acesso (`Collection`), a classificação (`Taxonomy`/tags), os níveis de sensibilidade e o **ciclo de vida com aprovação** que garante que só conhecimento confiável vira "oficial" para os consumidores.

## 2. Escopo

**Inclui:**
- Agregado `KnowledgeItem`: título + corpo livre + tags + 1 coleção + sensibilidade + ciclo de vida + **histórico de versões**.
- Agregado `Collection` (fronteira de acesso, **plana**).
- `Taxonomy`/`Tag`: tags **de sistema (imutáveis)** + tags **do tenant (customizadas)**.
- Ciclo de vida + governança: `Draft → InReview → Published → Deprecated/Archived`, com **aprovação por revisor** (respeitando `requireSeparateReviewer` da org).
- Versionamento com **snapshot por alteração** + **rollback**.
- Lookup estruturado (por título/tag/coleção — determinístico) e leitura do item.

**Não inclui:**
- Embeddings / busca semântica / chunks → **PRD-4**.
- Upload/parse de arquivos → **PRD-3**.
- Exposição a consumidores via API/MCP → **PRD-5**.
- Relacionamento entre itens (links "ver também") → fase posterior.

## 3. Personas
- **Curator/Expert** — cria/edita/submete itens; cria coleções? (não — Admin cria coleções; curador atribui). Gerencia tags do tenant.
- **Reviewer** — aprova/rejeita itens em revisão; deprecia/arquiva.
- **Admin** — cria/gerencia coleções; gerencia tags de sistema? (não — tags de sistema são imutáveis; Admin cria tags do tenant também).
- **Auditor** — lê itens, versões e histórico (via PRD-0/PRD-6).

## 4. Linguagem ubíqua
| Termo | Significado |
|---|---|
| **KnowledgeItem** | Unidade de conhecimento. Título + corpo livre (markdown/texto) + metadados. |
| **Collection** | Agrupamento que define **acesso**. Item pertence a **exatamente uma**. Plana (sem hierarquia). |
| **Tag** | Faceta de classificação. `system` (imutável, ex.: glossário/regra/processo/faq/documento) ou `tenant` (customizada). |
| **Sensitivity** | `público < interno < confidencial` (fixos, ordenados). |
| **Lifecycle Status** | `Draft → InReview → Published → Deprecated → Archived`. |
| **Version** | Snapshot imutável de (título+corpo+tags+sensibilidade) num ponto do tempo. |
| **Approval** | Transição InReview→Published feita por um Reviewer. |

## 5. Modelo de domínio

### Agregado `KnowledgeItem` (raiz)
- `KnowledgeItemId`, `companyId`, `collectionId`, `title`, `body` (texto livre), `tags: TagRef[]`, `sensitivity: SensitivityLevel`, `status: LifecycleStatus`, `currentVersion: number`, `versions: KnowledgeVersion[]`, `authorId`, `lastEditedBy`, timestamps, `publishedAt?`, `deprecatedAt?`.
- **Entidade filha** `KnowledgeVersion` (`versionNumber`, `title`, `body`, `tags`, `sensitivity`, `editedBy`, `createdAt`, `note?`).
- **Invariantes:**
  - Pertence a exatamente uma `Collection` (obrigatória), da mesma org.
  - `sensitivity` obrigatória (default sugerido `interno`).
  - Toda edição de conteúdo cria nova `KnowledgeVersion` e incrementa `currentVersion`.
  - Transições de status seguem a máquina de estados (abaixo); transições inválidas lançam erro de domínio.
  - Aprovação respeita política: se `requireSeparateReviewer`, `approvedBy != authorId/lastEditedBy`.
  - Só item `Published` é elegível à indexação/recuperação (PRD-4/5).
  - Tags devem existir na taxonomia da org (sistema ou tenant).

### Máquina de estados (governança completa)
```
Draft ──submit──► InReview ──approve──► Published ──deprecate──► Deprecated ──archive──► Archived
  ▲                  │                      │                                              ▲
  └──── reject ──────┘                      └────────────── archive ──────────────────────┘
Draft ──(edit)──► Draft        Published ──(edit)──► Draft (nova revisão) [decisão de design: re-publicar exige novo ciclo]
```
> Editar um item **publicado** cria nova versão em `Draft` (a versão publicada continua servindo até a nova ser aprovada) — confirmar no ADR de governança.

### Agregado `Collection`
- `CollectionId`, `companyId`, `name`, `description?`, `createdBy`. Plana. Nome único por org.
- Invariante: não pode ser apagada com itens dentro (ou exige realocação) — definir política.

### Agregado/Serviço `Taxonomy` (tags)
- `Tag`: `TagId`, `companyId?` (null = sistema/global), `slug`, `label`, `scope: 'system'|'tenant'`, `immutable: bool`.
- Tags de sistema: seed inicial imutável (`glossário, regra, processo, faq, documento`). Tenant cria/edita/remove as suas.
- Invariante: não dá para editar/remover tag de sistema; não dá para remover tag do tenant em uso (ou força destag).

### Value Objects
- `SensitivityLevel` (ordenável), `LifecycleStatus`, `TagRef`, `KnowledgeBody`, `Title`.

## 6. Domain Events
`KnowledgeItemDrafted`, `KnowledgeItemEdited` (→ `KnowledgeVersionCreated`), `KnowledgeItemSubmittedForReview`, `KnowledgeItemApproved`, `KnowledgeItemRejected`, `KnowledgeItemPublished`, `KnowledgeItemDeprecated`, `KnowledgeItemArchived`, `KnowledgeItemRolledBack`, `KnowledgeItemRetagged`, `KnowledgeItemMovedToCollection`, `CollectionCreated`, `CollectionRenamed`, `TenantTagCreated`, `TenantTagRemoved`.
> `KnowledgeItemPublished`/`Deprecated`/`Archived` são os gatilhos que o PRD-4 (indexação) consome.

## 7. Casos de uso

| Caso de uso | Ator | Regra-chave |
|---|---|---|
| `CreateKnowledgeItem` | Curator | Nasce em Draft; exige coleção + sensibilidade. |
| `EditKnowledgeItem` | Curator | Cria nova versão; se publicado, vira Draft de nova revisão. |
| `SubmitForReview` | Curator | Draft → InReview. |
| `ApproveItem` | Reviewer | InReview → Published; valida `requireSeparateReviewer`. |
| `RejectItem` | Reviewer | InReview → Draft + motivo. |
| `DeprecateItem` | Reviewer/Admin | Published → Deprecated. |
| `ArchiveItem` | Reviewer/Admin | → Archived (sai da recuperação). |
| `RollbackToVersion` | Curator/Reviewer | Restaura snapshot como nova versão Draft. |
| `RetagItem` / `MoveItemToCollection` | Curator | Valida taxonomia/coleção da org. |
| `CreateCollection` / `RenameCollection` | Admin | Nome único por org. |
| `CreateTenantTag` / `RemoveTenantTag` | Admin/Curator | Não toca tags de sistema. |
| Queries: `GetItem`, `ListItems(filtros)`, `GetVersionHistory`, `ListCollections`, `ListTags` | conforme papel | Sempre tenant-scoped. |

## 8. Contratos
Detalhe REST/MCP de **consumo** fica no PRD-5; aqui são endpoints de **curadoria** (humanos, ver PRD-6 para UI):
```
POST   /items, PATCH /items/:id, POST /items/:id/submit
POST   /items/:id/approve, /items/:id/reject
POST   /items/:id/deprecate, /items/:id/archive, /items/:id/rollback
GET    /items, GET /items/:id, GET /items/:id/versions
POST   /collections, PATCH /collections/:id, GET /collections
POST   /tags, DELETE /tags/:id, GET /tags
```

## 9. Persistência
- Schemas `knowledge_items`, `knowledge_versions` (filha), `collections`, `tags` — tenant-scoped (`company_id` + `CompanyFilter`). `tags` de sistema têm `company_id = null` e ficam fora do filtro (lookup global + por tenant).
- Índices: `(company_id, collection_id, status)`, `(company_id, status)` para listagens; índice por tag.
- Versões: append-only; nunca update destrutivo de versão.

## 10. Critérios de aceite
- [ ] Transições inválidas de status lançam erro de domínio (cobertas por testes de máquina de estados).
- [ ] Com `requireSeparateReviewer=true`, autor não aprova o próprio item; com `false`, aprova.
- [ ] Toda edição gera nova versão; `RollbackToVersion` restaura conteúdo como novo Draft.
- [ ] Só item Published é "servível" (flag/consulta usada pelo PRD-4/5).
- [ ] Tags de sistema são imutáveis; tags do tenant são isoladas por org.
- [ ] Item pertence a exatamente 1 coleção da própria org; mover valida org.
- [ ] Cada caso de uso emite o evento correto com `companyId`+`actorId`.
- [ ] Isolamento entre tenants em todas as queries (teste com 2 orgs).

## 11. Dependências e ordem
- Depende de PRD-0 (tenancy/eventos) e PRD-1 (papéis/RBAC dos casos de uso). Pré-requisito de PRD-3, PRD-4, PRD-5, PRD-6. Obs.: as **coleções definidas aqui** são referenciadas pelo escopo de credencial do PRD-1 — ciclo suave resolvido por validação de id em runtime (ver PRD-1 §11/§12).

## 12. Riscos & ADRs
- **ADR:** "Knowledge Lifecycle & Versioning" — máquina de estados, política de edição de publicados, snapshots vs event-sourcing para rollback.
- **ADR:** "Taxonomy: system vs tenant tags" — modelagem de tags globais imutáveis + filtro.
- **Decisão em aberto:** apagar coleção com itens (bloquear vs realocar). Seed inicial exato de tags de sistema.
