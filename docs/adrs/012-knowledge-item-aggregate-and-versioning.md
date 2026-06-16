# ADR-012: KnowledgeItem — Agregado, Versionamento e Modelo de "Servível"

## Status

Proposto

## Data

2026-06-12

## Contexto

O `KnowledgeItem` é o agregado central do produto: conteúdo versionado e governado que será servido a consumidores de IA. A descoberta decidiu guardar histórico como **snapshots** (não event-replay) por serem mais limpos para diff/rollback — concordamos com isso. Mas a PRD-2 modelou os snapshots como uma **coleção filha hidratada dentro do agregado** (`versions: KnowledgeVersion[]`) e usou um único campo `status`, e isso gera dois problemas. Primeiro, é uma coleção **ilimitada** que cresce a cada edição: carregar o item para qualquer operação hidrata todo o histórico, inchando memória e o upsert do `AggregatePersister`, sem que nenhuma invariante precise de todas as versões em memória. Segundo, a própria PRD se contradiz — diz que editar um publicado leva o `status` a `Draft`, mas também que "a versão publicada continua servindo"; um único `status` não representa "tem rascunho em andamento" **e** "tem versão publicada no ar" ao mesmo tempo. Tirar conteúdo do ar a cada edição é inaceitável para um produto cuja razão de existir é servir verdade a consumidores.

## Alternativas Consideradas

### 1. Versões como coleção filha hidratada no agregado (proposta original)

`KnowledgeItem` carrega `versions: KnowledgeVersion[]`; rollback opera in-memory; um campo `status`.

- **Prós:** atomicidade trivial; rollback é operação de domínio pura; modelo mental simples.
- **Contras:** coleção ilimitada carregada sempre (smell de agregado grande); upsert do histórico inteiro; e um único `status` não consegue manter "servindo" e "editando" simultâneos — força tirar o publicado do ar ao editar.

### 2. Event-sourcing do item (reconstruir versões por replay)

O estado e o histórico saem do replay dos domain events do item.

- **Prós:** sem store de snapshot separado; histórico é inerente.
- **Contras:** rollback/diff exigem replay; mais complexo; a descoberta já rejeitou replay para este caso.

### 3. Snapshots append-only fora do agregado + ponteiro de versão publicada (escolhida)

Cada versão é um snapshot imutável append-only, persistido **fora do agregado carregado** e referenciado por número. O agregado guarda o conteúdo de trabalho atual + `publishedVersion` (o que está servindo) + o ponteiro da versão de rascunho corrente + `status`.

- **Prós:** agregado pequeno (não arrasta histórico); "servível" desacopla de "editando", então editar/revisar uma nova versão **nunca** tira a publicada do ar; histórico lido sob demanda; rollback/diff fáceis por serem snapshots.
- **Contras:** mais peças (store de versões + ponteiros); "servível" passa a ser um ponteiro, não o `status` (menos óbvio à primeira vista); crescimento append-only.

## Decisão

Escolhida a **alternativa 3**.

- **Versão = snapshot imutável append-only.** Captura (título + corpo + tags + sensibilidade) num ponto do tempo. Nunca sofre update destrutivo. **Não** é entidade filha hidratada do agregado — diferente de coleções filhas *limitadas* (ex.: `User → Addresses`), versões são ilimitadas e imutáveis, então são um store append-only à parte, lido sob demanda (histórico, rollback).
- **O agregado guarda ponteiros, não o histórico.** `KnowledgeItem` carrega o conteúdo de trabalho atual, o `status` da versão de trabalho, e dois ponteiros: `publishedVersion` (a versão que está **servindo**) e a versão de rascunho corrente.
- **"Servível" é governado pelo ponteiro publicado, não pelo `status`.** Editar um item publicado cria um novo snapshot de rascunho e mexe no `status` **do rascunho**, enquanto `publishedVersion` continua apontando para o snapshot anterior, que **segue servindo**. Aprovar a nova versão move o ponteiro. É isto que torna "continua servindo durante a edição" coerente.
- **Atomicidade sem dual-write.** O snapshot é gravado na mesma transação (UoW) da edição; só não fica como coleção hidratada.
- **Rollback nunca muta histórico.** Restaurar a versão N lê o snapshot N e cria uma **nova** versão de rascunho com aquele conteúdo, que segue o ciclo normal de aprovação. O histórico é append-only de ponta a ponta.

As transições de estado que **removem** algo do serviço (arquivar) e a semântica de depreciação na recuperação ficam para a ADR-013/PRD-4; esta ADR fixa apenas a estrutura e a regra de que o ponteiro publicado é a fonte do que serve.

## Consequências

**Positivas:**

- Conteúdo publicado nunca sai do ar por causa de edição/revisão em andamento.
- Agregado pequeno: carregar o item não hidrata o histórico; persistência mais barata.
- Rollback e diff são triviais por serem snapshots; histórico imutável e auditável.

**Negativas:**

- Mais moving parts: um store/repositório append-only de versões, separado do agregado, com seu próprio persister.
- "Servível" deixa de ser legível direto no `status` — exige entender o ponteiro `publishedVersion` (mitigado por nomear bem e documentar).
- Crescimento append-only das versões (dívida de archival, análoga à de `system_events` — registrada, fora da v1).

**Neutras:**

- A semântica de deprecate/archive sobre o que serve é deferida à ADR-013/PRD-4.
- O gatilho de indexação (PRD-4) passa a observar mudanças no ponteiro publicado, não no `status` cru.

## Regras Derivadas

- Versões são imutáveis e append-only; nenhuma operação faz update destrutivo de uma versão.
- O agregado `KnowledgeItem` não carrega a lista de versões; referencia por número e lê snapshots sob demanda.
- "Servível" = existe `publishedVersion` (sujeito às regras de lifecycle da ADR-013); jamais derivado apenas do `status` da versão de trabalho.
- Criar versão (em edição/rollback) acontece na mesma transação do comando que a originou.
