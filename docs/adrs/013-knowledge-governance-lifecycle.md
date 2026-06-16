# ADR-013: Knowledge Governance Lifecycle

## Status

Proposto

## Data

2026-06-12

## Contexto

O `KnowledgeItem` só vira "verdade oficial" para os consumidores depois de passar por um ciclo de governança com aprovação. A ADR-012 já separou o que **serve** (ponteiro de versão publicada) do que está **em edição** (versão de trabalho), o que resolve a estrutura. Falta fixar o comportamento de governança: quais transições existem e como são forçadas, o que `Deprecated` e `Archived` significam para o que serve, como a política `requireSeparateReviewer` (que vive na `Organization`, outro agregado) chega à aprovação sem acoplar agregados, e o que acontece ao apagar uma coleção com itens. São regras de **domínio** (não autorização — ADR-011); a autorização grosseira por papel que decide *quem pode tentar* cada transição é a da ADR-011.

## Alternativas Consideradas

A decisão central é como modelar e forçar as transições de estado.

### 1. Campo `status` setável + validação na camada de serviço

`status` é um campo que se atribui; um serviço valida transições permitidas.

- **Prós:** simples e flexível.
- **Contras:** domínio anêmico; regra de transição espalhada e duplicável; é possível levar o item a um estado inválido a partir de qualquer lugar.

### 2. Transições como métodos de domínio guardados no agregado (escolhida)

Cada transição é um método nomeado (`submit`, `approve`, `reject`, `deprecate`, `archive`) que valida sua pré-condição, aplica o efeito e emite o evento; transição inválida lança erro de domínio.

- **Prós:** domínio rico; regra num lugar só; impossível alcançar estado inválido; testável como máquina de estados.
- **Contras:** mais métodos; o agregado passa a ser dono da máquina de estados.

### 3. Motor de workflow externo (lib/engine de state machine)

Um motor declarativo dirige as transições.

- **Prós:** declarativo, visualizável.
- **Contras:** exagero para 5 estados; acopla o domínio a um framework; contraria o estilo enxuto do template.

## Decisão

Escolhida a **alternativa 2**. Transições válidas:

| De | Ação | Para | Papel (autz grosseira, ADR-011) |
|---|---|---|---|
| Draft | submit | InReview | Curator |
| InReview | approve | Published | Reviewer |
| InReview | reject | Draft (+ motivo) | Reviewer |
| Published | edit | nova versão de rascunho (publicado segue servindo, ADR-012) | Curator |
| Published | deprecate | Deprecated | Reviewer/Admin |
| Published / Deprecated | archive | Archived | Reviewer/Admin |

Qualquer transição fora desta tabela lança erro de domínio.

**Semântica de serviço** (junto com o ponteiro publicado da ADR-012):

| Estado | Serve aos consumidores? |
|---|---|
| Draft / InReview (nunca publicado) | não |
| Published | sim |
| Deprecated | **sim, sinalizado como desatualizado** (frescor/confiança rebaixados — PRD-4) |
| Archived | não (removido da recuperação) |
| Publicado com rascunho em edição/revisão | sim — a versão **publicada** continua servindo |

`Deprecated` e `Archived` são, portanto, distintos: depreciar mantém o conteúdo encontrável porém marcado como velho; arquivar tira do ar.

**Revisor ≠ autor.** É invariante de domínio. A política `requireSeparateReviewer` mora na `Organization`, mas o item **não a alcança**: o caso de uso `ApproveItem` carrega a política e a **passa como parâmetro** ao método de domínio (`approve(reviewerId, requireSeparateReviewer)`). Com a política ativa, aprovar com `reviewerId` igual ao autor/último editor lança erro de domínio.

**Apagar coleção com itens.** Na v1, **bloqueia**: apagar coleção não-vazia falha com erro explícito. É regra **cross-aggregate** (Collection + itens), forçada num caso de uso/serviço de domínio que consulta os itens — nunca dentro do agregado `Collection`, que não os carrega. Realocação em lote fica para fase posterior.

## Consequências

**Positivas:**

- Estado inválido é inalcançável; a máquina de estados vive num lugar só e é testável.
- `Deprecated` vs `Archived` dão ao curador controle real sobre o que o consumidor vê e com que sinal de confiança.
- Aprovação respeita a política da org sem acoplar `KnowledgeItem` a `Organization`.

**Negativas:**

- O agregado ganha vários métodos de transição (mais superfície que um setter), aceito em troca de não ser anêmico.
- A regra de exclusão de coleção exige uma consulta cross-aggregate antes de apagar (não é invariante local) — um caso de uso precisa lembrar de fazê-la (mitigado por teste).
- Bloquear exclusão de coleção não-vazia transfere trabalho manual ao Admin até existir realocação em lote.

**Neutras:**

- A semântica de `Deprecated`/`Archived` na recuperação é consumida pela PRD-4 (índice observa o ponteiro publicado + o estado de lifecycle).
- Quem pode disparar cada transição é a autz grosseira por papel da ADR-011; aqui ficam só as regras de domínio da transição.

## Regras Derivadas

- Cada transição de lifecycle é um método de domínio guardado no `KnowledgeItem`; transição inválida lança erro de domínio.
- Serviço ao consumidor é função do ponteiro publicado (ADR-012) **e** do estado de lifecycle: `Published`/`Deprecated` servem (este último sinalizado), `Archived` e não-publicados não servem.
- A política `requireSeparateReviewer` é injetada no método de aprovação como parâmetro; o agregado nunca lê outro agregado.
- Exclusão de coleção não-vazia é bloqueada por um caso de uso/serviço de domínio que consulta os itens; não é invariante do agregado `Collection`.
