# ADR-020: Index Projection

## Status

Proposto

## Data

2026-06-13

## Contexto

O índice vetorial é um **read-model derivado e reconstruível** a partir do conhecimento publicado (princípio da descoberta; ADR-012 diz que o que serve é a versão publicada). Gerar embeddings é **caro de CPU**. Falta decidir *quando* e *como* a indexação roda em relação ao commit da publicação, e o modelo de consistência/idempotência/rebuild. Se a indexação rodar dentro da transação de publicação (como handler in-process síncrono do pipeline da ADR-005), o curador fica travado esperando o embedding e a publicação **falha** se o embedding falhar — acoplar um ato de governança ao sucesso de um artefato derivado é errado. O template não tem broker (ADR-006), mas já tem um event store persistido e um padrão de worker async in-process (ADR-015).

## Alternativas Consideradas

### 1. Projeção síncrona dentro da transação de publicação

Um handler in-process indexa antes do commit.

- **Prós:** índice sempre consistente com o DB no commit; sem janela de lag; sem worker extra.
- **Contras:** publicar bloqueia na latência do embedding; falha de embedding faz a publicação falhar/rollback (governança acoplada a artefato derivado); CPU pesada no caminho da request.

### 2. Projeção assíncrona eventualmente consistente, com o event store como fila (escolhida)

Um worker in-process consome os eventos persistidos (ADR-006) e projeta o índice; idempotente, com retry; o índice é reconstruível.

- **Prós:** publicar nunca bloqueia nem falha por embedding; reusa o padrão da ADR-015 (um modelo mental só); rebuild cura falha transitória.
- **Contras:** janela de consistência eventual (segundos) entre publicar e ficar buscável; o worker gerencia o próprio Actor Context; exige cursor/offset sobre o event store + idempotência.

### 3. Fila/worker externo (broker)

Projeção dirigida por uma fila durável dedicada.

- **Prós:** durável, escalável.
- **Contras:** infra nova (broker), contra o stack Node único — mesma rejeição da ADR-015.

## Decisão

Escolhida a **alternativa 2**. A indexação **nunca** roda dentro da transação de publicação; ela reage aos eventos **persistidos**, de forma assíncrona e eventualmente consistente. O **event store (ADR-006) é a fila**: um worker in-process consome os eventos relevantes e projeta.

- **Gatilhos** (alinhados à ADR-012/013): ponteiro de versão publicada **definido/movido** (publicação, aprovação de nova versão, rollback que vira publicado) → (re)indexa os chunks da versão publicada; `Deprecated` → **mantém indexado, marca flag stale** (a busca rebaixa frescor/confiança); `Archived` → **remove** do índice.
- **Idempotência:** reprojetar o mesmo item leva ao mesmo estado de índice.
- **Reconstrução:** `RebuildIndex(companyId?)` reprocessa do zero a partir dos itens publicados; o índice é 100% derivado — falha persistente se cura no rebuild.
- **Isolamento:** o worker abre o próprio Actor Context (`actorType = 'system'`, escopo privilegiado da ADR-009); nenhum acesso tenant-scoped fora dele.
- O *como* do chunking (estratégia) é da ADR-017; o vector store é da ADR-018. Aqui fica só o modelo de projeção.

## Consequências

**Positivas:**

- Publicar/governar fica desacoplado do embedding — nunca bloqueia nem falha por causa dele.
- Reusa o padrão async in-process da ADR-015: um modelo mental para ingestão e indexação.
- O índice se autocura via rebuild; `Deprecated` corretamente permanece-mas-sinalizado.

**Negativas:**

- Consistência eventual: existe uma janela (segundos) em que o item está `Published` no DB mas ainda não buscável.
- Mais um worker gerenciando o próprio Actor Context — superfície onde dá para errar isolamento se esquecido.
- Exige um cursor/offset durável sobre o event store + lógica de idempotência (maquinário real, não trivial).
- Worker in-process não é durável a crash sem recuperação (mesma ressalva da ADR-015).

**Neutras:**

- O índice é um read-model derivado (CQRS de leitura); não é fonte da verdade.
- A estratégia de chunking (ADR-017) e o vector store (ADR-018) são decididos à parte.

## Regras Derivadas

- Indexação nunca roda dentro da transação de publicação; reage aos eventos persistidos, assíncrona.
- O índice é derivado e deve ser totalmente reconstruível a partir dos itens publicados.
- A projeção é idempotente; `Deprecated` permanece indexado com flag stale, `Archived` é removido, mover o ponteiro publicado dispara reindexação.
- O worker de projeção abre o próprio Actor Context (`system`).
- **Emenda (2026-06-17):** cada chunk carrega os `tag_ids` do item publicado (denormalizados na projeção, com índice GIN — `Migration_011`); a busca filtra por **sobreposição de tags** (`tag_ids && :tags`), fail-closed quando o conjunto pedido é vazio. Assim o filtro `tags` do contrato de consumo (PRD-5) é real (antes era no-op).
