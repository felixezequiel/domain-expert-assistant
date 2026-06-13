# PRD-3: Ingestion

| Campo      | Valor                       |
| ---------- | --------------------------- |
| Status     | Proposto                    |
| Fase       | v1 (manual + upload)        |
| Contexto   | Ingestion                   |
| Depende de | PRD-0, PRD-1, PRD-2         |

## 1. Objetivo & valor

Permitir que o conhecimento **entre** no sistema pelos dois caminhos da v1: **autoria manual** (já coberta pelos casos de uso do PRD-2, exposta pela UI) e **upload de arquivos** (PDF/DOCX/MD/TXT), transformando um documento em **um `KnowledgeItem`** curável, com fatiamento interno (chunks) preparado para a recuperação do PRD-4.

> Decisão da descoberta: **upload = 1 item**; os chunks são internos e **invisíveis na curadoria**.

## 2. Escopo

**Inclui:**
- Pipeline de upload: receber arquivo → extrair texto → criar `KnowledgeItem` (Draft) com `body` derivado → fatiar em **chunks internos** (preparação p/ embedding no PRD-4).
- Formatos v1: **PDF, DOCX, MD, TXT**.
- Acompanhamento do processamento (status do job) e tratamento de falha.
- Autoria manual: reaproveita `CreateKnowledgeItem`/`EditKnowledgeItem` do PRD-2. Não passa pela extração de arquivo, mas o corpo **também é fatiado em chunks** (via `RechunkItem`), para que itens manuais sejam igualmente recuperáveis no PRD-4 — só a *origem* (arquivo vs. autoria) difere, não a presença de chunks.

**Não inclui (fora da v1):**
- **API push** programática de conhecimento.
- **Sync de fontes externas** (Confluence/Notion/Drive).
- OCR de imagens/PDFs escaneados (registrar como risco).
- Embeddings (são consumo dos chunks pelo PRD-4).

## 3. Personas
- **Curator** — faz upload, revisa o item gerado, ajusta título/tags/coleção/sensibilidade antes de submeter.

## 4. Linguagem ubíqua
| Termo | Significado |
|---|---|
| **UploadedDocument** | Arquivo bruto enviado + metadados (nome, mime, tamanho, hash). |
| **IngestionJob** | Processo de transformar um documento em item: `received → extracting → chunking → ready → failed`. |
| **Chunk** | Fatia de texto do item, com posição/offsets, para recuperação. Interno; não é entidade de curadoria. |
| **Extraction** | Conversão arquivo → texto (por tipo de arquivo). |

## 5. Modelo de domínio

### Agregado `IngestionJob` (raiz)
- `IngestionJobId`, `companyId`, `uploadedBy`, `document: { filename, mimeType, sizeBytes, contentHash, storageRef }`, `status`, `resultItemId?`, `error?`, `targetCollectionId`, `targetSensitivity`, timestamps.
- Entidade filha (ou tabela do item): `Chunk` (`chunkId`, `knowledgeItemId`, `ordinal`, `text`, `charStart`, `charEnd`).
- **Invariantes:**
  - Tamanho/mime validados na recepção (limites configuráveis).
  - `contentHash` evita reprocessar o mesmo arquivo idêntico no mesmo tenant (idempotência opcional).
  - Job só gera item quando `extracting` conclui com texto não-vazio; senão → `failed` com motivo.
  - Chunks pertencem ao `KnowledgeItem` resultante (mesma org), e são recriados se o corpo do item mudar.

### Relação com `KnowledgeItem`
- O job **cria** um `KnowledgeItem` em `Draft` (via o caso de uso do PRD-2), com `body` = texto extraído, `collectionId`/`sensitivity` = alvos informados no upload, `title` = nome do arquivo (editável).
- Chunking pode rodar na criação e **re-rodar** sempre que o `body` muda (gancho para PRD-4 reindexar).

## 6. Domain Events
`DocumentUploaded`, `IngestionStarted`, `TextExtracted`, `IngestionFailed`, `KnowledgeItemCreatedFromDocument`, `ItemChunked` (→ sinaliza ao PRD-4 que há chunks novos).
> `KnowledgeItemCreatedFromDocument` é um evento de **ingestão** e **não substitui** o `KnowledgeItemDrafted` do PRD-2: a criação do item dispara `KnowledgeItemDrafted` (domínio Knowledge) e a ingestão marca a origem com `KnowledgeItemCreatedFromDocument`, os dois ligados por `causationId` (PRD-0).

## 7. Casos de uso
| Caso de uso | Ator | Regra |
|---|---|---|
| `UploadDocument` | Curator | Valida mime/tamanho; cria `IngestionJob`; guarda arquivo. |
| `ProcessIngestionJob` | Sistema (assíncrono) | Extrai texto → cria item Draft → chunk → `ready`. Falha → `failed`+motivo. |
| `GetIngestionJob` | Curator | Acompanha status. |
| `RechunkItem` | Sistema | (Re)calcula chunks quando o corpo é definido ou alterado — reage a `KnowledgeItemDrafted` (criação, inclusive manual) e a `KnowledgeItemEdited` (edições). Idempotente. Cobre tanto itens de upload quanto manuais. |

> Processamento pode ser **inline** (v1 simples) ou via fila. Como não há broker no template, v1 pode processar de forma síncrona/em-processo com status persistido; ADR decide.

## 8. Contratos
```
POST   /ingestion/uploads        # multipart; body: collectionId, sensitivity → cria job
GET    /ingestion/jobs/:id        # status do processamento
GET    /ingestion/jobs            # lista jobs do tenant
```

## 9. Persistência
- Schemas `ingestion_jobs`, `chunks` — tenant-scoped (`company_id` + filtro).
- Armazenamento do arquivo bruto: filesystem local (`data/uploads/<company>/...`) na v1; abstrair via `FileStoragePort` para trocar por S3 depois.
- Índice em `chunks (company_id, knowledge_item_id, ordinal)`.

## 10. Critérios de aceite
- [ ] Upload de PDF/DOCX/MD/TXT válido gera `KnowledgeItem` Draft com texto extraído e chunks.
- [ ] Arquivo inválido (mime/tamanho) é rejeitado na recepção com erro claro.
- [ ] Extração vazia/falha → job `failed` com motivo; nenhum item órfão criado.
- [ ] Editar o corpo do item recalcula os chunks (evento `ItemChunked` reemitido).
- [ ] Chunks não aparecem em nenhuma API/UI de curadoria (são internos).
- [ ] Isolamento por tenant em jobs, chunks e arquivos.
- [ ] Eventos emitidos com `companyId`+`actorId`.

## 11. Dependências e ordem
- Depende de PRD-2 (cria item) e PRD-0/1. Alimenta PRD-4 (chunks → embeddings).

## 12. Riscos & ADRs
- **ADR:** "Ingestion Processing Model" — inline vs fila; estratégia de chunking (tamanho/overlap) e parsers por formato (ex.: `pdf-parse`, `mammoth` p/ docx).
- **ADR:** "File Storage Port" — local na v1, S3-compatível depois.
- **Risco:** PDFs escaneados sem texto (OCR fora de escopo) → job `failed` com mensagem orientando.
- **Decisão em aberto:** limites de tamanho/quantidade por tenant (sem cotas formais na v1).
