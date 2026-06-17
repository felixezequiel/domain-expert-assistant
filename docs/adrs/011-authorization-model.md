# ADR-011: Authorization Model

## Status

Aceito — implementado (RBAC por `requiredRoles` + `AuthorizerPort` no `ApplicationService`; ver a emenda de 2026-06-17 sobre autenticação na borda).

## Data

2026-06-12

## Contexto

A PRD-1 define papéis humanos (Admin/Curator/Reviewer/Auditor/Consumer) e escopo de credencial de consumidor, mas não fecha **onde** e **como** o "pode fazer isto?" é forçado. O sistema tem **dois adapters** de entrada para os mesmos casos de uso — HTTP (UI) e MCP — então qualquer enforcement que viva só num adapter é contornável pelo outro. A ADR-005 já estabelece o `ApplicationService` como orquestrador transversal que coordena transação, dispatch e event store via ports injetados; a ADR-008/010 fazem a borda resolver o principal e abrir o Actor Context com papéis frescos. Precisamos decidir o modelo de autorização sem reintroduzir boilerplate por caso de uso (que o template removeu de propósito) nem confundir controle de acesso com regra de negócio.

## Alternativas Consideradas

### 1. Autorização na borda (middleware/guards por adapter)

Cada adapter (HTTP, MCP) checa papel/escopo antes de chamar o caso de uso.

- **Prós:** simples, perto do transporte; nenhum estado novo.
- **Contras:** cada adapter reimplementa a regra; um check só no middleware HTTP é **silenciosamente contornado pelo caminho MCP**; não é testável como lógica de negócio.

### 2. Checagem explícita dentro de cada caso de uso

Cada `execute()` lê o Actor Context e afirma o papel no início.

- **Prós:** sem framework; explícito e local.
- **Contras:** é **esquecível** — um caso de uso novo sem o check vira buraco; repete o padrão "todo use case precisa lembrar de X" que o `AggregateTracker` eliminou.

### 3. Fronteira de aplicação via `AuthorizerPort`, decidido por Identity (escolhida)

O `ApplicationService` invoca um passo `authorize` antes do `execute`, delegando a decisão a um `AuthorizerPort` fornecido pelo contexto Identity & Access; o caso de uso apenas **declara** o papel que exige.

- **Prós:** um único ponto de enforcement, **agnóstico de adapter** (HTTP e MCP passam pelo mesmo ApplicationService); simétrico aos ports que o ApplicationService já usa (ADR-005); papéis vêm frescos do Actor Context; declarativo, sem encanamento no caso de uso.
- **Contras:** exige `Role` no shared kernel; adiciona um passo/indireção no pipeline; o **mecanismo de declaração** ainda precisa ser escolhido na implementação.

## Decisão

Escolhida a **alternativa 3**, com três delimitações deliberadas:

**1. Camada.** Autorização grosseira (por papel) é preocupação **transversal da camada de aplicação**: o `ApplicationService` invoca um passo `authorize` **antes do `execute`** (análogo ao passo `enrich` da ADR-008), delegando a um `AuthorizerPort`. *Onde* é invocado: aplicação, não-contornável por adapter. *Quem* decide: o domínio de Identity, dono do port. *O que* o caso de uso faz: declara o papel exigido. Papéis são lidos do **Actor Context** (resolvidos frescos na ADR-010), sem recarregar o `User`.

**2. `Role` no shared kernel.** O enum `Role` é **vocabulário de autorização compartilhado** entre contextos (um caso de uso de Knowledge pode exigir `Curator`), então mora no shared kernel. O contexto Identity continua dono da **atribuição** de papéis ao `User`, não do vocabulário — evita que outros contextos importem Identity só para declarar um requisito.

**3. Regras contextuais são domínio, não autorização.** "Revisor ≠ autor" (`requireSeparateReviewer`), "não desabilitar o último Admin" e afins **não** são autorização — são **invariantes de domínio**, forçadas no agregado/caso de uso porque são regra de negócio. Ficam **explicitamente fora** do `Authorizer`. O escopo do consumidor (coleção ∈ escopo, sensibilidade ≤ teto) é autorização **dependente de dado**, forçada na fronteira de **consumo** (PRD-5); o modelo é definido aqui, o enforcement é detalhado lá.

A v1 é **checagem grosseira por papel** — sem motor de permissões/políticas. O **mecanismo de declaração** (decorator, registry no bootstrap do módulo, ou método) é deixado **em aberto de propósito**: é detalhe de implementação, decidido no TDD, mantendo o grão declarativo e de baixo boilerplate do template.

## Consequências

**Positivas:**

- Um ponto de enforcement não-contornável, válido para HTTP e MCP igualmente.
- Simétrico ao desenho existente (ports injetados no ApplicationService, ADR-005); nenhum pattern novo.
- O domínio fica limpo de encanamento de controle de acesso; regras de negócio continuam no domínio.
- v1 simples; sem framework de permissões prematuro.

**Negativas:**

- `Role` no shared kernel é acoplamento real dos contextos a um vocabulário compartilhado (aceito conscientemente — é o preço de não importar Identity em todo lugar).
- Um passo a mais no pipeline (indireção).
- Risco de alguém reclassificar regra de domínio como autorização e enfiá-la no `Authorizer`; mitigado pela delimitação explícita desta ADR.
- O mecanismo de declaração fica como decisão pendente para a implementação (não resolvida aqui de propósito).

**Neutras:**

- Estende o pipeline da ADR-005 com um passo `authorize` antes do `execute`.
- Enforcement de escopo do consumidor é deferido à PRD-5; aqui fica só o modelo.

## Regras Derivadas

- `Role` mora no shared kernel; a atribuição de papéis ao `User` é do contexto Identity.
- Autorização grosseira por papel é invocada na fronteira de aplicação via `AuthorizerPort`, antes do `execute`; nenhum adapter implementa o check autoritativo.
- Invariantes de negócio que mencionam o ator (revisor ≠ autor, último Admin, etc.) são domínio — nunca entram no `Authorizer`.
- Escopo do consumidor é autorização dependente de dado, forçada na fronteira de consumo (PRD-5).
- O mecanismo de declaração do papel exigido não é fixado nesta ADR; é escolhido na implementação, consistente com o estilo declarativo do template.

## Emenda (2026-06-17): autenticação na borda, autorização no use case

A **autenticação** (resolver o cookie de sessão → `Actor` → abrir o `ActorContext`) estava copiada em cada bootstrap de módulo — um `authed`/`respond`/`respondError` duplicado, e os módulos não-Identity ainda importavam a infra de sessão da Identity (acoplamento). Isso foi hoistado para **um único wrapper de borda compartilhado**, `authenticatedRoute(sessionResolver, handler)` (`shared/infrastructure/http/`), que depende de um `SessionResolverPort` (shared kernel); a Identity fornece o adapter `CookieSessionResolver`. Rotas sem cookie usam `publicRoute(handler)`; o Consumption autentica por Bearer API-key (wrapper próprio).

Isto **não muda** o modelo desta ADR: a autorização (RBAC grosseiro) continua **declarada no use case** (`requiredRoles`) e aplicada pelo `ApplicationService` via `AuthorizerPort` antes do `execute`. A regra é a separação de responsabilidades: **autenticação ("quem") vive no wrapper de borda; autorização ("o quê") vive no use case** — nenhum módulo reimplementa o `authed`. Verificado: um curador chamando a rota só-de-auditor recebe `403 common.forbiddenRole` (autz preservada), enquanto a resolução do principal acontece uma vez no wrapper.
