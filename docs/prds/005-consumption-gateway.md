# PRD-5: Consumption Gateway (API + MCP)

| Campo      | Valor                               |
| ---------- | ----------------------------------- |
| Status     | Proposto                            |
| Fase       | v1                                  |
| Contexto   | Consumption (camada de interface)   |
| Depende de | PRD-0, PRD-1, PRD-2, PRD-4           |

## 1. Objetivo & valor

Expor o conhecimento aos **consumidores** (IAs, agentes, integrações, devs) de duas formas equivalentes — **API REST** e **servidor MCP sobre HTTP** — sempre **respeitando o escopo da credencial** (coleções + teto de sensibilidade). É a porta de entrada do "domain expert": é por aqui que o Claude de um time de suporte, um agente automatizado ou um dev "pergunta ao especialista".

> Não geramos resposta: devolvemos **trechos de conhecimento com atribuição e frescor**. A IA do consumidor raciocina.

## 2. Escopo

**Inclui:**
- **Autenticação de consumidor por API key** (resolve credencial + escopo — PRD-1).
- **Enforcement de escopo** em toda leitura: `RetrievalScope = {collectionIds da credencial} ∩ filtro do pedido`, `sensitivity ≤ ceiling`.
- **API REST** de consumo: busca semântica, lookup estruturado, navegação de catálogo, get item.
- **Servidor MCP sobre HTTP (Streamable/SSE)** expondo:
  - **Tools** — ações de busca/lookup/navegação.
  - **Resources** — itens publicados navegáveis nativamente pelo cliente MCP (dentro do escopo).
- Rate limiting básico por credencial; atualização de `lastUsedAt`.

**Não inclui:**
- Geração de respostas / orquestração de LLM.
- Feedback do consumidor / analytics (fora da v1).
- OAuth2 (só API key na v1).

## 3. Personas
- **Consumidor (máquina)** — IA/agente/integração com API key.
- **Consumidor humano** — usa a UI (PRD-6), que internamente chama esta API.

## 4. Linguagem ubíqua
| Termo | Significado |
|---|---|
| **Consumer** | Cliente autenticado por API key (não-humano, normalmente). |
| **MCP Tool** | Função exposta ao cliente MCP (ex.: `search_knowledge`). |
| **MCP Resource** | Documento/recurso navegável exposto via MCP (item publicado no escopo). |
| **Effective Scope** | Interseção entre o escopo da credencial e os filtros do pedido. |

## 5. Modelo / componentes
Camada de **adaptadores primários** sobre PRD-4 (busca) e PRD-2 (leitura), com um **PolicyService** central:

- `ConsumerAuthMiddleware` — API key → `ConsumerCredential` ativa → injeta **Actor Context** (`actorType='consumer'`) + `TenantContext` (PRD-0).
- `ScopeResolver` — monta `RetrievalScope` da credencial; recusa pedidos que extrapolam o escopo.
- `KnowledgeQueryFacade` — orquestra `SearchService`/`StructuredLookupService`/catálogo, sempre com escopo.
- `McpServer` (HTTP) — registra tools + resources; mapeia para o `KnowledgeQueryFacade`.

**Invariantes:**
- Nenhuma resposta inclui item fora do `Effective Scope` (coleção não permitida ou sensibilidade acima do teto).
- Só itens `Published` são visíveis a consumidores.
- Toda chamada autenticada é atribuível a uma credencial (auditável via PRD-0).

## 6. MCP — superfície proposta
**Tools:**
- `search_knowledge(query, { collectionIds?, tags?, k? })` → resultados com atribuição + frescor (busca híbrida).
- `lookup_knowledge({ title?, tag?, collectionId? })` → lookup determinístico.
- `list_collections()` / `list_tags()` → navegação (dentro do escopo).
- `get_knowledge_item(itemId)` → item publicado completo (se no escopo).

**Resources:**
- `knowledge://{collection}/{itemId}` — itens publicados navegáveis pelo cliente MCP, listados conforme escopo.

## 7. Casos de uso / endpoints REST
```
# Auth: header Authorization: Bearer <api-key>
GET  /v1/search?q=...&collection=...&tag=...&k=...     # busca híbrida
GET  /v1/lookup?title=...|tag=...|collection=...       # estruturado
GET  /v1/collections                                   # catálogo (escopo)
GET  /v1/tags                                          # facetas (escopo)
GET  /v1/items/:itemId                                 # item publicado (escopo)
# MCP:
ALL  /mcp            # endpoint Streamable HTTP/SSE, mesma API key
```

## 8. Contratos
Resposta de busca = lista de `SearchResult` (PRD-4) + eco do `effectiveScope` aplicado (transparência para o consumidor). Erros: `401` (key inválida/revogada), `403` (fora de escopo), `429` (rate limit).

## 9. Persistência
- Sem persistência de domínio nova (camada de leitura). Atualiza `ConsumerCredential.lastUsedAt`.
- Rate limit: contador em memória/loja simples na v1 (ADR se precisar distribuído).

## 10. Critérios de aceite
- [ ] Credencial só enxerga itens das coleções do seu escopo e com `sensitivity ≤ ceiling` (testes com múltiplas coleções/níveis).
- [ ] Item não-publicado nunca aparece a consumidor.
- [ ] Mesma busca via REST e via MCP tool retorna o mesmo conjunto (paridade).
- [ ] MCP resources lista apenas itens do escopo.
- [ ] Key revogada → 401; pedido fora de escopo → 403.
- [ ] Toda chamada é atribuível à credencial (auditoria PRD-0) e atualiza `lastUsedAt`.
- [ ] Isolamento total entre tenants (a key do tenant A jamais lê dados do tenant B).

## 11. Dependências e ordem
- Depende de PRD-0 (tenancy/ator/auditoria), PRD-1 (auth/escopo), PRD-2 (itens) e PRD-4 (busca). É a entrega que "liga o produto" para consumidores. Pré-requisito funcional do PRD-6 (a UI de consumo humano usa estes endpoints).

## 12. Riscos & ADRs
- **ADR:** "MCP Transport & Auth over HTTP" — Streamable HTTP/SSE, autenticação por API key, multi-tenant por header.
- **ADR:** "Scope Enforcement" — onde e como o filtro é aplicado de forma inescapável (defesa em profundidade: também no PRD-4).
- **Risco:** paridade REST↔MCP — extrair um `KnowledgeQueryFacade` único para evitar divergência.
- **Decisão em aberto:** política de rate limit (limites default por credencial).
