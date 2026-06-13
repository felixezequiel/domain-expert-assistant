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
- Sincronização por eventos: `KnowledgeItemPublished`/`ItemChunked` → (re)indexa; `Deprecated`/`Archived` → remove/marca.
- **Busca híbrida** (vetorial + palavra-chave/full-text) com fusão de scores.
- **Reranking** dos candidatos.
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
  3. fusão (ex.: Reciprocal Rank Fusion) + rerank,
  4. monta resultados com **atribuição** + **frescor**.
- `StructuredLookupService` — lookup determinístico por título/tag/coleção (não usa vetor).

**Metadados indexados por chunk** (para filtrar sem vazar): `companyId`, `collectionId`, `sensitivity`, `knowledgeItemId`, `itemStatus`, `publishedAt`.

**Invariantes:**
- Índice só contém chunks de itens `Published` do tenant.
- Toda busca é **obrigatoriamente** filtrada por `companyId` + `RetrievalScope` (sem escopo ⇒ sem resultados).
- Resultado sempre carrega atribuição (nunca um trecho "anônimo").

## 6. Domain Events
Consome: `KnowledgeItemPublished`, `ItemChunked`, `KnowledgeItemDeprecated`, `KnowledgeItemArchived`, `KnowledgeItemRolledBack`.
Emite (opcional/operacional): `IndexUpdated`, `IndexRebuildCompleted`.

## 7. Casos de uso / queries
| Operação | Descrição |
|---|---|
| `ProjectItemToIndex` | (event handler) (re)indexa chunks de item publicado. |
| `RemoveItemFromIndex` | (event handler) remove ao depreciar/arquivar. |
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
- Vector store: **decisão de ADR** (candidatos: `sqlite-vec` para manter um banco só; ou vector DB dedicado). O `VectorIndexPort` isola a escolha.
- Full-text: SQLite FTS5 (mesmo banco) na v1.
- Modelo de embedding: baixado/empacotado localmente; `EmbedderPort` permite trocar.

## 10. Critérios de aceite
- [ ] Publicar um item indexa seus chunks; depreciar/arquivar os remove (verificável via busca).
- [ ] `RebuildIndex` reconstrói tudo a partir do zero e a busca volta idêntica (índice é derivado).
- [ ] Busca sem `scope`/tenant retorna vazio (nunca vaza entre coleções/tenants/sensibilidade).
- [ ] Resultado respeita `sensitivityCeiling` e `collectionIds` do escopo.
- [ ] Busca híbrida supera busca só-vetorial e só-léxica num conjunto de testes de relevância (golden set).
- [ ] Todo resultado tem atribuição + frescor.
- [ ] Embedding roda **offline, sem chave/custo** (teste sem rede).

## 11. Dependências e ordem
- Depende de PRD-0 (tenancy/eventos), PRD-2 (itens/eventos) e PRD-3 (chunks). É consumido por PRD-5. A infra de embedding/índice e a busca podem ser **prototipadas cedo com fixtures**, mas a indexação real consome os chunks produzidos pelo PRD-3 — logo, o caminho ponta-a-ponta depende do PRD-3 (não roda em paralelo a ele).

## 12. Riscos & ADRs
- **ADR:** "Local Embedding Model & Library" — qual modelo multilingual, lib (Transformers.js vs alternativa), tamanho/latência, empacotamento. Recuperar aprendizados do antigo `n3-vector` (não versionado).
- **ADR:** "Vector Store Choice" — `sqlite-vec` vs vector DB dedicado; trade-offs de operação.
- **ADR:** "Hybrid Search & Reranking" — algoritmo de fusão e reranker.
- **Risco:** custo de CPU/latência do embedding local em multilíngue → medir; permitir warm-up do modelo.
