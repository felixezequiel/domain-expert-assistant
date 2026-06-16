# ADR-008: Actor Context & Event Envelope Enrichment

## Status

Proposto

## Data

2026-06-12

## Contexto

O event store (`system_events`, ADR-006) persiste todo domain event dentro da transação do agregado e é a base da trilha de auditoria exigida pela persona Auditor. Hoje o envelope do `DomainEvent` responde *o quê* (`eventName`), *quando* (`occurredAt`), *sobre qual agregado* (`aggregateId`) e *o que causou* (`causationId`) — mas não responde **quem** originou a ação nem **de qual tenant**. Sem isso a trilha não é auditável por tenant e o produto multi-tenant não consegue provar isolamento. Precisamos enriquecer o envelope sem poluir o domínio com identidade/tenancy e sem depender de cada caso de uso "lembrar" de preencher.

Novos campos do envelope:

| Campo | Significado |
|---|---|
| `companyId` | tenant que originou a ação (nulável para ações de sistema/operador) |
| `actorId` | quem originou — id do `User` ou da `ConsumerCredential` |
| `actorType` | natureza do ator (ver "Decisões adiadas") |

## Alternativas Consideradas

### 1. O agregado carrega quem/qual-tenant em cada evento

O próprio agregado recebe `companyId`/`actorId` e os coloca em cada evento que emite.

- **Prós:** envelope completo na origem; evento imutável de verdade (nada carimbado depois).
- **Contras:** vaza identidade e tenancy (preocupações de aplicação) para dentro do domínio; obriga cada caso de uso a propagar o ator manualmente; `EventEmittingAdapter` (que não é agregado) fica sem solução.

### 2. Carimbo cego a partir do contexto assíncrono no drain

A borda abre um contexto; no drain o orquestrador copia `companyId` e `actorId` do contexto para todos os eventos. (Proposta original da PRD-0.)

- **Prós:** domínio puro; uniforme; cobre agregado e adapter com um mecanismo só.
- **Contras:** confia 100% no contexto. Se o código carregar ou alterar um agregado de outro tenant (furo de filtro, colisão de id, caminho de escrita), o evento é carimbado com o tenant **errado** — vazamento cross-tenant silencioso e auditoria falsificada, sem nada que detecte.

### 3. Contexto na borda + carimbo no drain + cross-check fail-closed na aplicação (escolhida)

Igual à 2, mas a camada de aplicação valida, para todo evento originado de um `AggregateRoot`, que o `companyId` do agregado é igual ao do contexto antes de carimbar; divergência aborta a transação.

- **Prós:** domínio puro; uniforme; cobre adapter; transforma o pior bug (vazamento silencioso) em falha determinística. É a única defesa do caminho de **escrita**, que o filtro de leitura do MikroORM não cobre.
- **Contras:** a aplicação precisa ler o `companyId` do agregado de forma genérica (exige um contrato no shared kernel); uma comparação extra por evento; eventos de adapter ficam fora dessa rede (aceito conscientemente).

## Decisão

Escolhida a **alternativa 3**. Na borda — middleware HTTP e handler de sessão MCP — abrimos **um** Actor Context assíncrono `{ companyId, actorId, actorType }` derivado do principal autenticado. O `companyId` vem **sempre** do nosso registro (`User`/`ConsumerCredential`), nunca de entrada controlada pelo cliente (header, payload ou parâmetro). No drain, o `ApplicationService` carimba o envelope a partir desse contexto e, para eventos de agregado, executa o cross-check fail-closed.

A regra de match vive na **orquestração (aplicação), não no domínio**. Nenhum agregado ou caso de uso novo precisa lembrar de chamá-la: ela roda automaticamente sobre os agregados já rastreados pelo `AggregateTracker` (ADR-004), cruzando `event.aggregateId` com o agregado rastreado correspondente. Eventos sem agregado correspondente (ex.: `EventEmittingAdapter`) são carimbados só pelo contexto.

O passo de enriquecimento é inserido no pipeline da ADR-005 **entre `drain` e `dispatch`**, para que handlers in-process e eventos persistidos vejam o mesmo envelope completo.

## Consequências

**Positivas:**

- A trilha de auditoria responde quem/qual-tenant para todo evento de negócio.
- Vazamento cross-tenant silencioso vira erro determinístico — inclusive no caminho de escrita (`upsert`/flush) que o filtro de leitura do MikroORM não protege.
- O domínio continua sem conhecer identidade/tenancy; zero boilerplate por novo agregado.
- O cliente não consegue forjar o tenant: `companyId` deriva do principal no servidor.

**Negativas:**

- A aplicação passa a depender de um contrato "agregado tenant-scoped expõe `companyId`"; um agregado que esqueça de declará-lo não é checado (mitigado por convenção + teste de isolamento).
- Eventos de `EventEmittingAdapter` não têm contra o que validar — confiam apenas no contexto.
- Uma comparação extra por evento drenado (custo desprezível, mas existe).

**Neutras:**

- Estende o pipeline da ADR-005 com um passo de enriquecimento entre drain e dispatch.
- Estende o envelope da ADR-006 com três campos; colunas, índices e filtro de `system_events` são detalhe da ADR-009.

**Decisões adiadas:**

- Conjunto final de `actorType` (`user` | `consumer` | `system`) e se o **operador** que provisiona tenants precisa de um tipo próprio, além de onde eventos com `companyId` nulo são auditados → ADR-009 + PRD-1.
- Mecanismo de autenticação em si (formato do token de UI, fluxo de login, se um humano pode pertencer a mais de uma org) → PRD-1. A ADR-008 depende só do contrato "a borda entrega `{ companyId, actorId, actorType }`".

## Regras Derivadas

- Todo agregado tenant-scoped expõe seu `companyId` por um contrato do shared kernel (base ou interface tenant-scoped), para a aplicação ler genericamente — único requisito por domínio.
- Nenhum handler (HTTP, tool MCP ou resource MCP) executa fora de um Actor Context; abrir o contexto é responsabilidade exclusiva da borda.
- `companyId` no contexto deriva sempre do principal autenticado no servidor; nunca de payload, parâmetro ou header controlado pelo cliente.
- Carimbo e cross-check acontecem entre `drain` e `dispatch` no `ApplicationService`; nada no domínio invoca o match.
