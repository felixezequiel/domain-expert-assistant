# PRD-3: Ingestion

| Campo      | Valor                       |
| ---------- | --------------------------- |
| Status     | Proposto                    |
| Fase       | v1 (manual + upload)        |
| Contexto   | Ingestion                   |
| Depende de | PRD-0, PRD-1, PRD-2         |

## 1. Objetivo & valor

Permitir que o conhecimento **entre** no sistema pelos dois caminhos da v1: **autoria manual** (já coberta pelos casos de uso do PRD-2, exposta pela UI) e **upload de arquivos** (PDF/DOCX/MD/TXT), transformando um documento em **um `KnowledgeItem`** curável (Draft) com o texto extraído.

> Decisão da descoberta: **upload = 1 item**. O fatiamento (chunking) para recuperação **não** é responsabilidade da ingestão — ele vive na PRD-4 e reage à *publicação* do item (ADR-012/013), não à criação/edição do rascunho.

## 2. Escopo

**Inclui:**
- Pipeline de upload: receber arquivo → extrair texto → criar `KnowledgeItem` (Draft) com `body` derivado.
- Formatos v1: **PDF, DOCX, MD, TXT**.
- Acompanhamento do processamento (status do job) e tratamento de falha.
- Autoria manual: reaproveita `CreateKnowledgeItem`/`EditKnowledgeItem` do PRD-2. Só a *origem* (arquivo vs. autoria) difere; o resultado é o mesmo `KnowledgeItem`.

**Não inclui (fora da v1):**
- **API push** programática de conhecimento.
- **Sync de fontes externas** (Confluence/Notion/Drive).
- OCR de imagens/PDFs escaneados (registrar como risco).
- **Chunking e embeddings → PRD-4** (reagem à publicação, não à ingestão).

## 3. Personas
- **Curator** — faz upload, revisa o item gerado, ajusta título/tags/coleção/sensibilidade antes de submeter.

## 4. Linguagem ubíqua
| Termo | Significado |
|---|---|
| **UploadedDocument** | Arquivo bruto enviado + metadados (nome, mime, tamanho, hash). |
| **IngestionJob** | Processo de transformar um documento em item: `received → extracting → ready → failed`. |
| **Extraction** | Conversão arquivo → texto (por tipo de arquivo). |

## 5. Modelo de domínio

### Agregado `IngestionJob` (raiz)
- `IngestionJobId`, `companyId`, `uploadedBy`, `document: { filename, mimeType, sizeBytes, contentHash, storageRef }`, `status`, `resultItemId?`, `error?`, `targetCollectionId`, `targetSensitivity`, timestamps.
- **Invariantes:**
  - Tamanho/mime validados na recepção (limites configuráveis).
  - `contentHash` evita reprocessar o mesmo arquivo idêntico no mesmo tenant (idempotência opcional).
  - Job só gera item quando `extracting` conclui com texto não-vazio; senão → `failed` com motivo.

### Relação com `KnowledgeItem`
- O job **cria** um `KnowledgeItem` em `Draft` (via o caso de uso do PRD-2), com `body` = texto extraído, `collectionId`/`sensitivity` = alvos informados no upload, `title` = nome do arquivo (editável).
- A partir daí o item segue a governança do PRD-2; o chunking/indexação para recuperação é da PRD-4 e reage à **publicação**, não à criação do Draft.

## 6. Domain Events
`DocumentUploaded`, `IngestionStarted`, `TextExtracted`, `IngestionFailed`, `KnowledgeItemCreatedFromDocument`.
> `KnowledgeItemCreatedFromDocument` é um evento de **ingestão** e **não substitui** o `KnowledgeItemDrafted` do PRD-2: a criação do item dispara `KnowledgeItemDrafted` (domínio Knowledge) e a ingestão marca a origem com `KnowledgeItemCreatedFromDocument`, os dois ligados por `causationId` (PRD-0). Eventos de indexação (chunking) são da PRD-4.

## 7. Casos de uso
| Caso de uso | Ator | Regra |
|---|---|---|
| `UploadDocument` | Curator | Valida mime/tamanho; cria `IngestionJob`; guarda arquivo; retorna na hora. |
| `ProcessIngestionJob` | Sistema (assíncrono) | Extrai texto → cria item Draft → `ready`. Falha → `failed`+motivo. |
| `GetIngestionJob` | Curator | Acompanha status. |

> Modelo de processamento (async in-process, tabela de jobs como fila, recuperação de crash) e parsers por formato → **ADR-015**.

## 8. Contratos
```
POST   /ingestion/uploads        # multipart; body: collectionId, sensitivity → cria job
GET    /ingestion/jobs/:id        # status do processamento
GET    /ingestion/jobs            # lista jobs do tenant
```

## 9. Persistência
- Schema `ingestion_jobs` — tenant-scoped (`company_id` + filtro).
- Armazenamento do arquivo bruto atrás de um `FileStoragePort` (local na v1, S3 depois) → **ADR-016**.

## 10. Critérios de aceite
- [ ] Upload de PDF/DOCX/MD/TXT válido gera `KnowledgeItem` Draft com o texto extraído.
- [ ] Arquivo inválido (mime/tamanho) é rejeitado na recepção com erro claro.
- [ ] Extração vazia/falha → job `failed` com motivo; nenhum item órfão criado.
- [ ] Upload retorna imediatamente; o status do job é acompanhável até `ready`/`failed`.
- [ ] Isolamento por tenant em jobs e arquivos.
- [ ] Eventos emitidos com `companyId`+`actorId`.

## 11. Dependências e ordem
- Depende de PRD-2 (cria item) e PRD-0/1. Alimenta PRD-4 (chunks → embeddings).

## 12. Riscos & ADRs
- **ADR-015 — Ingestion Processing Model** (escrita): async in-process com tabela de jobs como fila, recuperação de crash, Actor Context do worker, parsers por formato.
- **ADR-016 — File Storage Port** (escrita): arquivo bruto local na v1 atrás de porta (S3 depois); isolamento no adapter (storageRef por `companyId` + validação por leitura), fora do filtro de DB.
- **Risco:** PDFs escaneados sem texto (OCR fora de escopo) → job `failed` com mensagem orientando.
- **Decisão em aberto:** limites de tamanho/quantidade por tenant (sem cotas formais na v1).
