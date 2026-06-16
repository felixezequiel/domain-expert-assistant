# ADR-015: Ingestion Processing Model

## Status

Proposto

## Data

2026-06-13

## Contexto

A ingestão por upload transforma um arquivo (PDF/DOCX/MD/TXT) em texto e cria um `KnowledgeItem` em Draft (via o caso de uso do PRD-2). A extração — sobretudo de PDF e DOCX — pode ser lenta; fazê-la **inline na request de upload** bloqueia a conexão e arrisca timeout em arquivos grandes. O template é um monólito síncrono e **não tem message broker** (ADR-006), então adotar uma fila externa significaria infra nova, contra o estilo de stack Node única e poucas dependências. Precisamos de um modelo de processamento que não bloqueie o upload, não exija infra nova, trate falha sem deixar item órfão, e da escolha de parsers por formato. (Chunking foi movido para a PRD-4; aqui a ingestão entrega apenas o texto extraído.)

## Alternativas Consideradas

### 1. Extração síncrona inline na request

O upload extrai o texto e cria o item dentro da mesma request.

- **Prós:** o mais simples; sem infra nova; resultado imediato.
- **Contras:** bloqueia a request; timeout em arquivos grandes; sem retry; UX ruim.

### 2. Worker async in-process com a tabela de jobs como fila (escolhida)

A tabela `ingestion_jobs` **é** a fila: o upload cria um job `received` e retorna na hora; um worker in-process pega jobs pendentes, processa e atualiza o status; o cliente acompanha por `GetIngestionJob`.

- **Prós:** sem infra nova (sem broker); upload retorna imediatamente; status observável; retry/recuperação possíveis.
- **Contras:** o job vive atrelado ao processo — um crash no meio deixa job preso (exige recuperação no startup); sem escalar workers sem coordenação; o worker roda fora de uma request e precisa **abrir o próprio Actor Context**.

### 3. Fila/worker externo (ex.: BullMQ + Redis)

Fila durável dedicada com workers separados.

- **Prós:** durável, com retry e escala horizontal.
- **Contras:** infra nova (Redis); contraria o stack Node único; exagero para o volume da v1.

## Decisão

Escolhida a **alternativa 2**. O upload valida mime/tamanho, guarda o arquivo (via `FileStoragePort` — ADR-016), cria um `IngestionJob` em `received` e **retorna imediatamente**. Um worker in-process processa: extrai texto → cria `KnowledgeItem` Draft (caso de uso do PRD-2) → marca `ready`. Extração vazia ou com erro → `failed` + motivo, **sem criar item órfão**.

- **Recuperação de crash:** jobs em estado não-terminal (`extracting`) encontrados no startup são re-enfileirados (`received`) ou marcados `failed` após N tentativas — nunca ficam presos em silêncio.
- **Actor Context do worker:** como roda fora de uma request HTTP, o worker abre o próprio contexto (`companyId` do job, `actorType = 'system'`) no escopo privilegiado da ADR-009; nenhum acesso a dado tenant-scoped acontece fora dele. A autoria do item registra o `uploadedBy` do job.
- **Parsers TS-native por formato:** `pdf-parse` (PDF), `mammoth` (DOCX), MD/TXT lidos direto, atrás de uma abstração `Extractor` chaveada por mime, para acrescentar formatos sem tocar o pipeline. PDF escaneado (sem camada de texto) → extração vazia → `failed` com mensagem orientando (OCR fora de escopo).

## Consequências

**Positivas:**

- Upload não-bloqueante e sem infra nova; status acompanhável.
- Falhas explícitas e sem item órfão; parsers extensíveis por mime.

**Negativas:**

- O worker in-process não é durável a crash sem a recuperação de startup (complexidade extra obrigatória, não opcional).
- Sem escala de múltiplos workers na v1.
- O worker precisa gerenciar o próprio Actor Context — mais um lugar onde dá para errar isolamento se esquecido (mitigado pelo helper de escopo privilegiado da ADR-009).
- Uma extração longa consome recurso do mesmo processo, podendo afetar latência de outras requests.

**Neutras:**

- `ingestion_jobs` acumula papel de fila além de registro.
- Chunking/indexação acontecem depois, na PRD-4, reagindo à publicação — não aqui.

## Regras Derivadas

- O upload retorna imediatamente com um id de job; o processamento é async in-process.
- Jobs em estado não-terminal no startup são recuperados (re-enfileirados ou `failed`), nunca deixados presos.
- O worker abre o próprio Actor Context (`companyId` do job, `actorType = 'system'`); nenhum acesso tenant-scoped fora dele.
- Extração é por-mime atrás de uma abstração `Extractor`; extração vazia vira `failed`, jamais um item órfão.
