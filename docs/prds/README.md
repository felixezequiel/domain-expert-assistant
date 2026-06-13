# PRDs — Domain Expert Assistant

Product Requirement Documents do **Domain Expert Assistant**: um SaaS multi-tenant que serve a *verdade do domínio de negócio* de um cliente a consumidores de IA (suporte, agentes, devs) via **API REST + servidor MCP**. Nós cuidamos da **curadoria, governança e recuperação inteligente (RAG local e gratuito)**; a **IA é responsabilidade do consumidor** — só fornecemos contexto, nunca geramos respostas.

Construído sobre o template DDD + Arquitetura Hexagonal deste repositório.

## Visão em uma frase

> Uma base de conhecimento de negócio **governada, multi-tenant**, com recuperação **AI-native** (MCP + API), onde a inteligência mora na **recuperação** e a verdade mora na **curadoria humana**.

## Índice dos PRDs

| #                                         | Título                       | Bounded Context             | Resumo                                                                                          |
| ----------------------------------------- | ---------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| [0](000-foundation-cross-cutting.md)      | Foundation & Cross-cutting   | Shared / Tenancy / Audit    | Endurecer multi-tenancy, enriquecer domain events (`actorId` + `companyId`), trilha de auditoria. |
| [1](001-identity-and-access.md)           | Identity & Access            | Identity & Access           | Organizações, usuários, papéis, convites, login (email+senha); credenciais de consumidor (API key) com escopo. |
| [2](002-knowledge-core.md)                | Knowledge Core               | Knowledge (CORE)            | `KnowledgeItem`, `Collection`, `Taxonomy`/tags, sensibilidade, ciclo de vida/governança, versionamento. |
| [3](003-ingestion.md)                     | Ingestion                    | Ingestion                   | Autoria manual + pipeline de upload de arquivos (documento → 1 item + chunks internos).         |
| [4](004-retrieval-and-indexing.md)        | Retrieval & Indexing         | Retrieval & Indexing        | Embeddings locais (grátis), índice vetorial derivado, busca híbrida, rerank, atribuição, frescor. |
| [5](005-consumption-gateway.md)           | Consumption Gateway          | Consumption (interface)     | API REST + MCP-over-HTTP (tools + resources) com enforcement de escopo da credencial.           |
| [6](006-curation-admin-ui.md)             | Curation & Admin UI          | Frontend (5 personas)       | UI para Admin, Curador, Revisor, Auditor e Consumidor humano.                                   |

## Ordem de implementação

```
PRD-0  Foundation         (base — pré-requisito de todos)
  ↓
PRD-1  Identity           (depende de: 0)
  ↓
PRD-2  Knowledge (CORE)   (depende de: 0, 1)
  ↓
PRD-3  Ingestion          (depende de: 0, 1, 2)
  ↓
PRD-4  Retrieval          (depende de: 0, 2, 3)
  ↓
PRD-5  Consumption        (depende de: 0, 1, 2, 4)
  ↓
PRD-6  UI                 (depende de: 1, 2, 3, 5)
```

Ordem topológica de implementação. As setas mostram a cadeia principal; cada nó anota o conjunto **completo** de dependências diretas (idêntico ao cabeçalho "Depende de" de cada PRD). PRD-0 é pré-requisito de todos; PRD-1 e PRD-2 (CORE) sustentam o resto. PRD-3 → PRD-4 formam o pipeline conteúdo → chunks → busca. PRD-5 amarra o lado de leitura para consumidores e PRD-6 é a interface humana sobre todos.

## Decisões transversais (já fechadas na descoberta)

- **Multi-tenant** — todo agregado escopado por `companyId` (usa `TenantContext` + `CompanyFilter` do template).
- **Só contexto, nunca geração** — sem inferência LLM nossa; sem gerenciamento de chaves de modelo de geração.
- **Embeddings locais e grátis** — TS-native (ex.: Transformers.js/ONNX, modelo multilingual). Sem API paga. Detalhe de vector store fica em ADR.
- **TS é a fonte da verdade** (SQLite/MikroORM); índice vetorial é **derivado** e reconstruível, sincronizado por domain events.
- **Tudo é documento + tags** — modelo de conteúdo unificado; tags de sistema (imutáveis) + tags do tenant.
- **Acesso** — item pertence a **1 coleção** (fronteira de acesso, plana) + **N tags** (facetas); credencial de consumidor tem escopo = {coleções, teto de sensibilidade}.
- **Sensibilidade** — 3 níveis fixos ordenados: `público < interno < confidencial`.
- **Governança** — Draft → In-Review → Published → Deprecated/Archived + versionamento; **revisor distinto do autor é configurável por tenant** (`requireSeparateReviewer`).
- **Idioma** — multilíngue amplo.
- **Provisionamento de tenant** — feito por operador (nós). Sem signup público nem billing/cotas na v1.
- **Fora da v1** — feedback do consumidor, detecção de lacunas, analytics de uso, SSO, notificações, billing, sync de fontes externas, ingestão via API push, log de consumo (read-side audit).
