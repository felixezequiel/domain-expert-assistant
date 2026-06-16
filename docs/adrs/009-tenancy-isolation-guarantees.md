# ADR-009: Tenancy Isolation Guarantees

## Status

Aceito — implementado (defesa de aplicação na v1; piso de RLS ligado em 2026-06-16, ver emenda)

## Data

2026-06-12

## Contexto

O produto é multi-tenant: todo agregado é escopado por `companyId` e o pior incidente possível é um tenant ler ou escrever dado de outro. O template já tem o esqueleto de tenancy (contexto de tenant, filtro de company), mas faltam garantias explícitas: *onde* o isolamento é forçado, *o que acontece quando não há tenant no contexto* e *o que cobre o caminho de escrita* — já que o filtro do MikroORM age em `SELECT`, não em `upsert`/flush. A ADR-008 introduziu a trava `aggregate.companyId === contexto`; esta ADR define o regime de isolamento completo e fecha o enum de `actorType` que a ADR-008 deixou em aberto. Estamos sobre SQLite, que não tem row-level security — o isolamento é necessariamente forçado pela aplicação.

## Alternativas Consideradas

### 1. Disciplina do desenvolvedor (WHERE manual por repositório)

Cada repositório adiciona `companyId` na cláusula `WHERE` à mão.

- **Prós:** sem mágica; fácil de ler caso a caso.
- **Contras:** depende de lembrar em todo lugar; um único esquecimento é vazamento; não cobre escrita nem dá comportamento definido sem tenant.

### 2. Só o filtro de leitura do ORM

Habilita o filtro global do MikroORM no início da transação e confia que ele cobre o acesso.

- **Prós:** automático para `SELECT`; pouco código.
- **Contras:** não cobre o caminho de escrita (`upsert`/flush de entidade gerenciada); o comportamento sem tenant fica indefinido (tende a vazar tudo ou retornar vazio silenciosamente, escondendo bugs).

### 3. Defesa em duas camadas, fail-closed, com bypass explícito de operador (escolhida)

Filtro de leitura no início da transação **mais** a trava de escrita da ADR-008, acesso sem tenant **negado por padrão**, e um único bypass: escopos privilegiados (operador/sistema) abertos explicitamente.

- **Prós:** cobre leitura e escrita; toda falha de isolamento vira erro determinístico; o bypass é raro, explícito e auditável.
- **Contras:** mais peças e uma convenção obrigatória em toda schema; o escopo privilegiado é um poder perigoso que precisa ser bem guardado; por ser forçado na aplicação, qualquer acesso que contorne a camada de aplicação (SQL cru, acesso direto ao banco) não é protegido.

## Decisão

Escolhida a **alternativa 3**. O isolamento é forçado em duas camadas, ambas fail-closed:

- **Leitura** — o `MikroOrmUnitOfWork`, ao iniciar a transação, habilita o filtro de company com o `companyId` do contexto. Toda `EntitySchema` tenant-scoped declara esse filtro e a coluna `company_id`.
- **Escrita** — a trava da ADR-008 (`aggregate.companyId === contexto`), além de carimbar o evento, é o que impede gravação cross-tenant; ao persistir, o `companyId` da entidade ORM vem **do agregado**, nunca do contexto.

**Comportamento sem tenant no contexto** segue uma regra de três vias:

| Situação | Comportamento |
|---|---|
| Contexto com `companyId` | filtro habilitado com aquele tenant |
| Sem `companyId` e **sem** escopo privilegiado | **erro** (fail-closed) — nunca retorna vazio nem tudo |
| Escopo privilegiado explícito (operador/sistema) | filtro deliberadamente desligado |

O escopo privilegiado é aberto explicitamente (ex.: provisionamento de tenant pelo operador, migrações) e **nunca** é alcançável a partir de caminhos de consumidor ou de UI de tenant.

**`actorType` final:** `user` | `consumer` | `system` | `operator`. `operator` é distinto de `system`: `operator` é um humano nosso com responsabilidade (quem provisionou o tenant), `system` é job/migração automático. Isso fecha a decisão adiada na ADR-008.

**Ações com `companyId` nulo** (operador/sistema) são **capturadas** no log de eventos como qualquer outra, mas, como o filtro por tenant nunca casa com `company_id` nulo, são **invisíveis para o auditor de tenant** — por construção. Um plano de auditoria de operador (leitura cross-tenant) fica fora da v1; capturamos sem expor.

**Emenda (2026-06-13, ADR-014):** `company_id = null` numa tabela tenant-scoped tem **dois sentidos explícitos**: (1) **dado operacional** de escopo privilegiado (operador/sistema), invisível em escopo normal; e (2) **dado de referência compartilhado, imutável e read-only** (ex.: tags de sistema), que é deliberadamente legível por todos os tenants via um filtro de tabela que inclui `scope = 'system'`. O segundo sentido não enfraquece o isolamento porque vocabulário compartilhado não-confidencial não é dado privado de tenant. Qualquer tabela que use o sentido (2) deve declará-lo explicitamente no seu filtro e documentá-lo.

**Emenda (2026-06-16, ADR-018/ADR-022) — IMPLEMENTADA:** agora que a persistência é Postgres (ADR-018), o **buraco do caminho de escrita/SQL cru** descrito acima foi fechado ligando **Row-Level Security (RLS)** como **piso de tenant**. Como ficou (commit `b99d7f3`):

- **Transação por request** — o `MikroOrmUnitOfWork` abre uma transação por request (refactor de flush-ownership, ADR-004) e, dentro dela, publica o escopo em GUCs **transaction-local** via `set_config`: `app.current_company` (escopo de tenant) ou `app.bypass_rls = 'on'` (escopo privilegiado operador/sistema). Sendo transaction-local, nunca vazam entre conexões do pool.
- **Downgrade de role** — em seguida faz `SET LOCAL ROLE app_runtime` (role sem privilégio, criado pela migração). É **essencial**: o usuário da conexão é dono das tabelas e superuser, e **ambos ignoram RLS** — só um role comum fica sujeito à política. As migrações continuam rodando como o dono/superuser (ex.: `CREATE EXTENSION` exige).
- **Políticas fail-closed** — `FORCE ROW LEVEL SECURITY` + política `company_id = current_setting('app.current_company', true)` (ou `OR app.bypass_rls = 'on'`) nas **7 tabelas de dados**: `chunks`, `collections`, `knowledge_items`, `knowledge_versions`, `ingestion_jobs`, `tags` (que também expõe linhas `scope='system'` na leitura, ADR-014) e `system_events`. Sem GUC ⇒ `current_setting` é NULL ⇒ nenhuma linha casa: contexto esquecido devolve zero, nunca tudo.
- **Escopo** — as tabelas de **identidade/auth** (`organizations`, `users`, `sessions`, `consumer_credentials`) ficam **fora** do RLS forçado: a resolução de sessão e de API key as lê **pré-autenticação** (antes de existir contexto de tenant), por hash de segredo de alta entropia, e seguem guardadas pelo `CompanyFilter` da aplicação uma vez no contexto. Estendê-las exige rotear os lookups pré-auth por um escopo de bypass — follow-up de baixa prioridade.

O filtro de aplicação (`CompanyFilter`) **permanece** como camada primária/ergonômica; o RLS é a rede inescapável **abaixo** dele. Validado contra Postgres real: a **query crua do `pgvector` (ANN) como tenant errado devolve 0 linhas** — exatamente o furo que a ADR-022 apontava. Isso transforma a consequência negativa "isolamento forçado só na aplicação" desta ADR em defesa em profundidade real.

## Consequências

**Positivas:**

- Isolamento coberto em leitura e escrita; qualquer furo vira erro barulhento, não vazamento silencioso.
- Comportamento sem-tenant é definido e testável; "retorna vazio" deixa de mascarar bug.
- Ações privilegiadas ficam registradas e atribuídas a um operador nomeado, não anônimas.

**Negativas:**

- O escopo privilegiado é um bypass real de isolamento; vira superfície de segurança que precisa ser blindada contra alcance indevido.
- Toda nova schema tenant-scoped **precisa** declarar filtro + coluna; esquecer torna a entidade globalmente visível (mitigado por convenção, helper e teste de isolamento com dois tenants).
- Ações de operador são capturadas mas **não visíveis** na v1 (sem plano de auditoria de operador) — ponto cego conhecido até esse plano existir.
- ~~Isolamento forçado só na aplicação: acesso que contorne a camada de aplicação (SQL cru) não é protegido.~~ **Resolvido pela emenda de 2026-06-16:** o RLS do Postgres é o piso inescapável, que pega até o SQL cru/`pgvector`. Resíduo: as tabelas de auth ainda dependem só do filtro de aplicação (lidas pré-auth por hash de segredo) até o RLS ser estendido a elas.

**Neutras:**

- `system_events` ganha `company_id`, `actor_id`, `actor_type` e o filtro por tenant, com índices em `(company_id, occurred_at)` e `(company_id, aggregate_id)` para a consulta do Auditor.
- Migração MikroORM acrescenta as colunas e índices ao log existente.

## Regras Derivadas

- Toda `EntitySchema` tenant-scoped declara o filtro de company e a coluna `company_id`; um helper ou checklist documentado torna isso o caminho padrão, e um teste de isolamento com dois tenants é obrigatório por agregado.
- Acesso a repositório tenant-scoped fora de um contexto de tenant e fora de escopo privilegiado é erro — nunca silêncio.
- Escopo privilegiado (operador/sistema) é aberto explicitamente na borda/composição e jamais exposto a caminhos de consumidor ou UI de tenant.
- Ao persistir, o `companyId` da entidade ORM é derivado do agregado, não do contexto.
- O piso de RLS é forçado pela transação por request: `set_config('app.current_company' | 'app.bypass_rls')` + `SET LOCAL ROLE app_runtime` no `onBegin` (ambos transaction-local). Toda tabela de dados tenant-scoped roda `FORCE ROW LEVEL SECURITY` com política fail-closed; o role de runtime nunca é dono nem superuser. Tabela de auth lida pré-autenticação fica fora do RLS forçado até o lookup pré-auth ser roteado por bypass.
