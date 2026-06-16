# ADR-021: MCP Server — Transport, Auth & Tool/Resource Model

## Status

Proposto

## Data

2026-06-16

## Contexto

O MCP é o **canal principal** de consumo do produto. Os consumidores da v1 são **programáticos** — agentes, integrações e devs — com API key emitida por nós, integrando nosso servidor MCP no stack deles. Uma verificação da spec e dos clientes (2026) mostrou: a autorização do MCP é **moldada em OAuth 2.1** (opcional, mas se há auth em HTTP a spec gira em torno de RFC 9728/PKCE); **API key como bearer funciona tecnicamente** (o handshake não quebra) e é **suportada por Claude Code, Cursor e clientes programáticos/SDK**, mas **não** por clientes OAuth-only como o ChatGPT. Decidiu-se que alcançar ChatGPT-connector **não é requisito de v1**.

## Alternativas Consideradas

A decisão de peso é a autenticação.

### 1. OAuth 2.1 desde o dia um

Servidor de recurso OAuth + RFC 9728 + PKCE + registro de cliente.

- **Prós:** alcance total de clientes, incluindo ChatGPT e marketplaces de IA; spec-compliant.
- **Contras:** custo alto de implementação na v1; sobrepõe a decisão de API key opaca/ OAuth-adiado da ADR-010; desnecessário para o público programático da v1.

### 2. API key como Bearer na v1, OAuth como Fase 2 (escolhida)

`Authorization: Bearer <api-key>` validado no servidor; OAuth fica para depois.

- **Prós:** funciona para o público real da v1 (agentes, devs, Claude Code, Cursor, SDK próprio); consistente com a ADR-010; baixo custo; itera rápido.
- **Contras:** não alcança clientes OAuth-only (ChatGPT, talvez Copilot) até a Fase 2; está fora do envelope de auth da spec do MCP.

### 3. Esquema de header customizado (não-bearer)

Header proprietário em vez de `Bearer`.

- **Prós:** nenhum sobre o bearer.
- **Contras:** suporte de cliente ainda menor; bearer é a língua franca. Rejeitado.

## Decisão

Escolhida a **alternativa 2**.

- **Transporte:** **Streamable HTTP** (padrão atual do MCP; não o HTTP+SSE legado).
- **Auth:** API key apresentada como `Authorization: Bearer <api-key>`, validada no servidor → resolve a `ConsumerCredential` (ADR-010) → abre o Actor Context (`actorType = 'consumer'`, ADR-008). A sessão MCP é amarrada à credencial no estabelecimento. A v1 retorna **401 limpo** e deixa o **gancho de discovery RFC 9728** preparado, para que adotar OAuth na Fase 2 (alcance de clientes OAuth-only como ChatGPT) **não** seja um redesenho que quebra.
- **Tools vs Resources:** **tools = ações** invocadas pelo modelo (`search_knowledge`, `lookup_knowledge`, `list_collections`, `list_tags`, `get_knowledge_item`); **resources = itens publicados endereçáveis** via template `knowledge://{collection}/{itemId}`, com listagem **escopada e paginada** — **nunca** enumeração da base inteira. Busca/lookup (tools) são a descoberta primária.
- **Paridade REST↔MCP:** as duas superfícies delegam a um **`KnowledgeQueryFacade` único**; nenhuma implementa sua própria lógica de query/escopo. O enforcement de escopo (ADR-022) vale igual nas duas.

## Consequências

**Positivas:**

- Funciona para o público real da v1 a custo baixo; consistente com a ADR-010.
- O `KnowledgeQueryFacade` único evita divergência REST/MCP e centraliza o escopo (ADR-022).
- 401 limpo + gancho de discovery tornam o OAuth uma evolução não-disruptiva.

**Negativas:**

- Não alcança clientes OAuth-only (ChatGPT, talvez Copilot) até a Fase 2 — limite de distribuição aceito conscientemente para a v1.
- API key como bearer está fora do envelope de auth da spec do MCP — interoperabilidade com clientes estritamente spec-compliant é limitada.

**Neutras:**

- OAuth 2.1 + RFC 9728 é o caminho documentado de Fase 2.
- Transporte é o padrão vigente (Streamable HTTP).

## Regras Derivadas

- Transporte MCP = Streamable HTTP; auth v1 = API key como `Bearer` → resolve credencial → Actor Context; sessão amarrada à credencial.
- A v1 responde 401 limpo e mantém o gancho de discovery RFC 9728 para a Fase 2 (OAuth).
- Tools são ações; resources são itens via template escopado e paginado — sem enumerar a base inteira.
- REST e MCP passam pelo `KnowledgeQueryFacade` único; o escopo é sempre forçado conforme a ADR-022.
