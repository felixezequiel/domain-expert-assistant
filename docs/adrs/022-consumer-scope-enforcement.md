# ADR-022: Consumer Scope Enforcement

## Status

Proposto

## Data

2026-06-16

## Contexto

A consumption (PRD-5) é a superfície **mais exposta** do produto: consumidores externos (IAs/agentes) via API key. Toda leitura precisa ser restringida ao escopo da credencial — **coleções permitidas + teto de sensibilidade + só itens servíveis** — de forma inescapável. A ADR-011 definiu que o escopo do consumidor é forçado nesta fronteira de consumo. Complica: o caminho de busca inclui uma query de similaridade do `pgvector` (ADR-018) que **escapa do filtro de aplicação** do MikroORM (buraco admitido na ADR-009) e tem uma armadilha de *filtered ANN*. Já decidimos ligar **RLS** para o piso de tenant (emenda à ADR-009).

## Alternativas Consideradas

### 1. Pós-filtro após a recuperação

Recupera o top-K e descarta o que está fora do escopo depois.

- **Prós:** simples de escrever.
- **Contras:** **subflui** o K (devolve menos/zero resultados válidos quando o escopo é estreito); arrisca vazar metadado de item proibido na resposta; quebra a relevância. Inaceitável.

### 2. Pré-filtro na query, camada única de aplicação

Condições de escopo no `WHERE`, mas confiando só no facade de aplicação.

- **Prós:** correto e centralizado.
- **Contras:** camada única — se algum caminho de query (ex.: a query crua do pgvector) esquecer o filtro, vaza.

### 3. Pré-filtro na query + RLS como piso, defesa em profundidade (escolhida)

Escopo por-credencial é pré-filtro de aplicação; o piso de tenant é RLS no banco.

- **Prós:** correto, sem vazamento, e à prova de "query que esqueceu o filtro"; cada camada na altitude certa.
- **Contras:** duas camadas para manter alinhadas; *filtered ANN* exige tuning.

## Decisão

Escolhida a **alternativa 3**. O escopo é **pré-filtro na query** (nunca pós-filtro), **fail-closed** (sem escopo ⇒ resultado vazio), em duas camadas:

- **Piso de tenant (`companyId`) → Postgres RLS** (emenda à ADR-009): inescapável, vale até para a query crua do `pgvector` que não passa pelo filtro de aplicação.
- **Escopo por-credencial → pré-filtro de aplicação** no `WHERE`: `collectionId ∈ escopo da credencial`, `sensitivity ≤ teto`, e só itens **servíveis** (ponteiro publicado; `Deprecated` aparece sinalizado como desatualizado, `Archived` não aparece — ADR-013/020). Resolvido pelo `ScopeResolver` a partir da credencial.

**Escopo efetivo = escopo da credencial ∩ filtros do pedido.** O pedido só pode **estreitar** dentro do que a credencial permite; pedir explicitamente uma coleção fora do escopo retorna **403**, nunca "alarga".

**Armadilha do `pgvector` (filtered ANN):** busca ANN com `WHERE` seletivo pode subfluir resultados (o índice acha vizinhos e filtra depois). Mitigar com *iterative index scans* do pgvector e/ou over-fetch com verificação; **obrigatório testar com escopos estreitos** — é um furo que só aparece em produção.

## Consequências

**Positivas:**

- Resultados corretos e sem vazamento, inclusive na query crua de vetor.
- Defesa em profundidade: RLS (piso de tenant) + pré-filtro de aplicação (escopo por-credencial).
- Correção em escopos estreitos garantida por construção (pré-filtro, não pós).

**Negativas:**

- *Filtered ANN* exige configuração/tuning (risco de subfluxo se ignorado).
- Duas camadas de enforcement para manter alinhadas (RLS + aplicação).
- O pré-filtro de escopo adiciona complexidade à query de busca.

**Neutras:**

- Depende da emenda de RLS da ADR-009 e do Postgres da ADR-018.
- `Deprecated` continua visível ao consumidor, sinalizado (coerente com ADR-013).

## Regras Derivadas

- Escopo é sempre **pré-filtro** na query, nunca pós-filtro; sem escopo ⇒ resultado vazio.
- Escopo efetivo = credencial ∩ pedido; o pedido só estreita, nunca alarga; fora do escopo ⇒ 403.
- RLS força o piso de `companyId`; o pré-filtro de aplicação força coleções + teto + servível.
- O subfluxo de *filtered ANN* do pgvector deve ser testado com escopos estreitos e mitigado.
