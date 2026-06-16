# PRD-4: Retrieval & Indexing

| Campo      | Valor                          |
| ---------- | ------------------------------ |
| Status     | Proposto                       |
| Fase       | v1 — "onde mora a inteligência"|
| Contexto   | Retrieval & Indexing           |
| Depende de | PRD-0, PRD-2, PRD-3            |

## 1. Objetivo & valor

Tornar o conhecimento **recuperável de forma inteligente**. É aqui que mora a inteligência da solução: gerar **embeddings locais e gratuitos**, manter um **índice vetorial derivado** sincronizado por eventos, e responder buscas com **qualidade de domain expert** — busca híbrida, reranking, **atribuição de fonte** e sinais de **frescor/confiança**.

> Princípio: TS é a fonte da verdade; **o índice é derivado e 100% reconstruível** a partir dos itens `Published`.

## 2. Escopo

**Inclui:**
- `EmbedderPort` + adapter **local TS-native** (ex.: Transformers.js/ONNX, modelo multilingual). Sem API paga.
- `VectorIndexPort` + adapter (vector store decidido em ADR) — indexa **chunks** de itens `Published`.
- Chunking dos itens publicados (movido da PRD-3): estratégia acoplada ao modelo de embedding → ADR-017.
- Sincronização por eventos (modelo → ADR-020): ponteiro de versão publicada definido/movido → (re)indexa; `Deprecated` → mantém indexado com flag stale; `Archived` → remove.
- **Busca híbrida** (vetorial + full-text) com fusão por **RRF** (ADR-019).
- **Reranking**: abstração (`RerankerPort`) pronta mas **desligada na v1** — ligável sob medição (ADR-019).
- **Atribuição de fonte**: cada trecho retornado referencia o `KnowledgeItem` (id, título, coleção, versão).
- **Frescor/confiança**: idade, status, score normalizado por resultado.
- Reindexação completa (rebuild) sob demanda.

**Não inclui:**
- Geração de resposta (nunca; só contexto).
- Enforcement de escopo de credencial (fica no PRD-5; aqui a busca aceita um **filtro de escopo** já resolvido).
- Feedback/analytics (fora da v1).

## 3. Personas
- Indireta: **Consumidores** (via PRD-5) e **Consumidor humano** (busca na UI, PRD-6).

## 4. Linguagem ubíqua
| Termo | Significado |
|---|---|
| **Embedding** | Vetor de um texto, gerado por modelo local. |
| **Vector Index** | Estrutura derivada que guarda embeddings de chunks + metadados para busca. |
| **Hybrid Search** | Combinação de similaridade vetorial + match léxico (full-text). |
| **Reranking** | Reordenação dos candidatos por relevância antes de retornar. |
| **Source Attribution** | Metadados de origem de cada trecho (item, título, coleção, versão, sensibilidade). |
| **Freshness** | Idade/recência + status do conhecimento, devolvidos para a IA consumidora ponderar. |
| **Retrieval Scope** | Filtro {collectionIds, sensitivityCeiling} aplicado à busca (resolvido pelo PRD-5). |

## 5. Modelo de domínio / componentes

Este contexto é majoritariamente **infra/serviço de leitura** (read side / CQRS), não um agregado de negócio rico.

- `EmbedderPort.embed(texts): number[][]` — adapter local; modelo carregado em processo.
- `VectorIndexPort`:
  - `upsert(chunkVectors: { chunkId, knowledgeItemId, vector, metadata })`
  - `remove(byItemId | byChunkId)`
  - `search(queryVector, filter: RetrievalScope, k)` → candidatos com score.
- `IndexProjection` — handler de domain events que mantém o índice (idempotente; só itens `Published`).
- `SearchService.search(queryText, scope, options)`:
  1. embed da query (local) + tokenização léxica,
  2. busca vetorial + busca full-text (FTS), filtradas pelo `scope`,
  3. fusão por RRF (rerank é porta opcional, desligada na v1 — ADR-019),
  4. monta resultados com **atribuição** + **frescor**.
- `StructuredLookupService` — lookup determinístico por título/tag/coleção (não usa vetor).

**Metadados indexados por chunk** (para filtrar sem vazar): `companyId`, `collectionId`, `sensitivity`, `knowledgeItemId`, `itemStatus`, `publishedAt`.

**Invariantes:**
- Índice só contém chunks de itens `Published` do tenant.
- Toda busca é **obrigatoriamente** filtrada por `companyId` + `RetrievalScope` (sem escopo ⇒ sem resultados).
- Resultado sempre carrega atribuição (nunca um trecho "anônimo").

## 6. Domain Events
Consome (do event store, assíncrono — ADR-020): `KnowledgeItemPublished`, `KnowledgeItemDeprecated`, `KnowledgeItemArchived`, `KnowledgeItemRolledBack` (quando o rollback vira publicado).
Emite (opcional/operacional): `IndexUpdated`, `IndexRebuildCompleted`.

## 7. Casos de uso / queries
| Operação | Descrição |
|---|---|
| `ProjectItemToIndex` | (worker async) (re)indexa chunks da versão publicada; ao depreciar, marca flag stale. |
| `RemoveItemFromIndex` | (worker async) remove ao **arquivar** (depreciar não remove). |
| `RebuildIndex(companyId?)` | Reconstrói índice a partir dos itens publicados. |
| `SemanticSearch(query, scope, k, options)` | Busca híbrida + rerank + atribuição + frescor. |
| `StructuredLookup(criteria, scope)` | Determinístico por metadados. |

## 8. Contratos
Interno (consumido pelo PRD-5). Forma do resultado:
```
SearchResult {
  itemId, title, collectionId, sensitivity,
  snippet, chunkOrdinal,
  score,              // normalizado 0..1
  freshness: { publishedAt, ageDays, status },
  attribution: { itemId, title, version }
}
```

## 9. Persistência / infra
- Persistência: **Postgres** (mudança fundacional — ADR-018), com `pgvector` para o índice vetorial e full-text nativo do Postgres para o léxico. `VectorIndexPort` isola a escolha.
- Modelo de embedding: local via Transformers.js/ONNX (ADR-017); `EmbedderPort` permite trocar; a dimensão do vetor é fixada pelo modelo, dentro do limite de índice do pgvector.

## 10. Critérios de aceite
- [ ] Publicar um item indexa seus chunks (após a janela assíncrona); `Archived` remove; `Deprecated` permanece buscável com sinal de desatualizado (verificável via busca).
- [ ] Publicar não bloqueia nem falha por causa do embedding (indexação é assíncrona).
- [ ] `RebuildIndex` reconstrói tudo a partir do zero e a busca volta idêntica (índice é derivado).
- [ ] Busca sem `scope`/tenant retorna vazio (nunca vaza entre coleções/tenants/sensibilidade).
- [ ] Resultado respeita `sensitivityCeiling` e `collectionIds` do escopo.
- [ ] Busca híbrida supera busca só-vetorial e só-léxica num conjunto de testes de relevância (golden set).
- [ ] Todo resultado tem atribuição + frescor.
- [ ] Embedding roda **offline, sem chave/custo** (teste sem rede).

## 11. Dependências e ordem
- Depende de PRD-0 (tenancy/eventos) e **PRD-2** (itens publicados + eventos). Como o chunking agora mora aqui, a PRD-4 **não depende mais da PRD-3**: ela indexa qualquer `KnowledgeItem` publicado, tenha vindo de upload (PRD-3) ou de autoria manual (PRD-2). PRD-3 e PRD-4 passam a ser irmãs (ambas sobre PRD-2). É consumido por PRD-5. Embedding/índice/busca podem ser prototipados cedo com fixtures.

## 12. Riscos & ADRs
- **ADR-017 — Local Embedding & Chunking** (escrita): BGE-M3 fp16 via `@huggingface/transformers` v3 (1024-dim, janela 8192, MIT, sem prefixo); fallback gte; chunking structure-aware + ~512 tokens + overlap.
- **ADR-018 — Persistence Engine & Vector Store** (escrita): Postgres para tudo + `pgvector` + full-text do Postgres; mudança fundacional, destrava RLS (ADR-009).
- **ADR-019 — Hybrid Search & Reranking** (escrita): RRF in-DB (pgvector + full-text do Postgres); reranking atrás de `RerankerPort` desligado na v1, ligável sob golden-set.
- **ADR-020 — Index Projection** (escrita): projeção assíncrona eventual, event store como fila, idempotente, reconstruível.
- **Risco:** custo de CPU/latência do embedding local em multilíngue → medir; permitir warm-up do modelo.
