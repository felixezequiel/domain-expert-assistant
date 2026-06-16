# ADR-018: Persistence Engine & Vector Store — Postgres + pgvector

## Status

Proposto

## Data

2026-06-16

## Contexto

A PRD-4 precisa de um vector store para o índice de embeddings. A escolha recaiu sobre **pgvector**, que é uma extensão do **Postgres** — ou seja, exige Postgres rodando. O template hoje usa **SQLite** por padrão (`mikro-orm.config.ts`, contexto da ADR-006). Uma vez que Postgres entra para os vetores, manter SQLite como fonte da verdade significaria operar dois engines de banco onde um é superconjunto do outro. Além disso, ter domínio + vetores + full-text no mesmo Postgres permite **busca híbrida numa query só** (ADR-019). Logo, a escolha do vector store arrasta uma decisão **fundacional** de engine de persistência.

## Alternativas Consideradas

### 1. SQLite como fonte da verdade + Postgres só para vetores (dois bancos)

Domínio/governança em SQLite; índice vetorial derivado em Postgres/pgvector.

- **Prós:** mantém o zero-config do SQLite para o domínio; mudança mínima nos módulos existentes.
- **Contras:** dois engines (um superconjunto do outro) = overhead operacional (dois dialetos de migração, duas conexões, dois backups); busca híbrida precisa cruzar dois stores.

### 2. Postgres para tudo + pgvector (escolhida)

Postgres é o único engine: domínio, governança, event store e índice vetorial derivado.

- **Prós:** um engine só; `pgvector` + full-text do Postgres permitem fusão híbrida in-DB; índice continua derivado, mas no mesmo banco (rebuild mais fácil); troca de driver no MikroORM; **destrava o Postgres RLS** como defesa em profundidade para o buraco de "SQL cru contorna o isolamento" da ADR-009.
- **Contras:** perde o zero-config do SQLite (dev/CI passam a exigir Postgres via docker); é mudança fundacional que toca config/migrations/tipos; setup local mais pesado.

### 3. Vector DB dedicado (Qdrant/Weaviate/etc.) + SoR à parte

Store vetorial especializado, separado do banco relacional.

- **Prós:** recursos vetoriais purpose-built.
- **Contras:** mais um componente de infra com ops próprio; busca híbrida cruzando stores; exagero para a v1; e o usuário já escolheu pgvector.

## Decisão

Escolhida a **alternativa 2**. **Postgres é o engine único de persistência** de todos os bounded contexts (domínio, governança, event store e o índice vetorial derivado). `pgvector` guarda os embeddings dos chunks; o **full-text nativo do Postgres** cobre o léxico; a fusão híbrida (ADR-019) pode rodar in-DB. O MikroORM troca do driver SQLite para o driver Postgres.

A **dimensão do vetor** é fixada pelo modelo de embedding escolhido na ADR-017 e **deve caber no limite de índice do pgvector** — isso vira um critério de seleção do modelo. O índice permanece um read-model **derivado e reconstruível** (ADR-020), agora uma tabela com coluna `pgvector` no mesmo banco.

Esta é uma **mudança fundacional** que emenda a premissa de SQLite embutida no template: `mikro-orm.config.ts`, migrations, tipos e o `CLAUDE.md` passam a refletir Postgres, e dev/CI provisionam Postgres (docker-compose).

## Consequências

**Positivas:**

- Um engine só; busca híbrida unificada (pgvector + FTS do Postgres) possivelmente numa query.
- Índice derivado no mesmo banco simplifica o rebuild da ADR-020.
- Os filtros de tenant do MikroORM (ADR-009) seguem funcionando; e o **Postgres RLS** fica disponível como defesa em profundidade futura, fechando o buraco do "SQL cru contorna o isolamento de aplicação" que a ADR-009 admitiu.

**Negativas:**

- Perde o zero-config do SQLite: dev e CI precisam de Postgres (docker), mais atrito de onboarding.
- Mudança fundacional: config, migrations, tipos e docs (incl. `CLAUDE.md`) migram de SQLite para Postgres; todas as schemas passam a mirar o dialeto Postgres.
- A equipe passa a operar Postgres (backup, tuning, extensão pgvector instalada).

**Neutras:**

- A dimensão do vetor fica pendente do modelo da ADR-017 (dentro do limite do pgvector).
- Adotar RLS de fato é uma decisão futura separada; aqui só fica registrado que Postgres a habilita.

## Regras Derivadas

- Postgres é o único datastore; não há SQLite em nenhum ambiente.
- O índice vetorial é uma tabela `pgvector` derivada, no mesmo banco, reconstruível (ADR-020).
- A dimensão de embedding (ADR-017) tem de caber no limite de índice do pgvector.
- Busca híbrida é composta in-DB (ADR-019).
- Dev e CI provisionam Postgres (docker-compose); migrations usam o dialeto Postgres.
