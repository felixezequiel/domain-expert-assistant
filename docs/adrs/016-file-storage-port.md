# ADR-016: File Storage Port

## Status

Proposto

## Data

2026-06-13

## Contexto

A ingestão guarda o arquivo bruto enviado (PDF/DOCX/MD/TXT) antes e depois de extrair o texto. Esse arquivo vive **fora do banco**, logo **fora do `CompanyFilter`** da ADR-009 — o isolamento de tenant no armazenamento de arquivos não é coberto pelo filtro de DB e vira responsabilidade explícita de quem acessa o arquivo. Precisamos de uma abstração de armazenamento que permita começar simples (filesystem local) e trocar por object storage (S3) depois sem mexer em domínio/aplicação, e que feche essa segunda superfície de isolamento.

## Alternativas Consideradas

### 1. Escrever no filesystem direto, sem porta

Casos de uso gravam/leem arquivos no fs com caminhos.

- **Prós:** o mais simples possível.
- **Contras:** acopla a ingestão ao fs; migrar para S3 depois toca todos os call sites; difícil de testar; isolamento espalhado.

### 2. `FileStoragePort` com adapter de filesystem local na v1 (escolhida)

Uma porta hexagonal; adapter local agora, adapter S3-compatível depois.

- **Prós:** trocar o backend sem tocar domínio/aplicação; testável com adapter in-memory; isolamento centralizado num adapter.
- **Contras:** uma porta + adapter a construir; leve indireção.

### 3. Guardar os bytes do arquivo no próprio banco (BLOB)

O arquivo vira coluna binária numa tabela tenant-scoped.

- **Prós:** ganha o `CompanyFilter` e a transacionalidade de graça; uma fonte só; resolveria o isolamento sem esforço extra.
- **Contras:** incha o SQLite com binário grande; ruim de memória/performance; é a ferramenta errada para blobs; migração para S3 fica torta. O custo supera a conveniência de isolamento — que resolvemos no adapter.

## Decisão

Escolhida a **alternativa 2**. Acesso ao arquivo bruto sempre via `FileStoragePort`; adapter de filesystem local na v1 (`data/uploads/<companyId>/<jobId>/...`), adapter S3-compatível em fase posterior.

O **isolamento de tenant é responsabilidade do adapter** — segunda superfície, independente do filtro de DB da ADR-009. Aplicamos o mesmo princípio fail-closed: o `storageRef` é **sempre** escopado por `companyId`, **e** o adapter valida o `companyId` do Actor Context contra o `storageRef` em **toda leitura** — não confia só no caminho. Caminho escopado sem checagem seria uma porta lateral de vazamento por path.

O arquivo bruto é **mantido após a extração** (proveniência e re-extração com um parser melhor no futuro); descarte/retenção fica como otimização posterior.

## Consequências

**Positivas:**

- Trocar para S3 não toca domínio nem aplicação; testável com adapter in-memory.
- Isolamento de arquivo centralizado num único adapter, fail-closed.

**Negativas:**

- O armazenamento de arquivo é uma **segunda superfície de isolamento**, que precisa ser mantida correta independentemente do filtro de DB — risco contínuo, não eliminado, só centralizado.
- Arquivos brutos acumulam (crescimento de storage; archival fica como dívida, análoga à de `system_events`).
- A checagem por leitura é trabalho extra em todo acesso (custo baixo, mas real).

**Neutras:**

- Os bytes brutos **nunca são embeddados**; o que vai para a recuperação (PRD-4) é o texto extraído/publicado. Linhagem: arquivo bruto → texto (`KnowledgeItem.body`) → chunks → vetores.

## Regras Derivadas

- Todo acesso a arquivo bruto passa pelo `FileStoragePort`; nada lê o fs direto.
- `storageRef` é escopado por `companyId`; o adapter valida o `companyId` do Actor Context em toda leitura (fail-closed).
- O arquivo bruto é retido após a extração; políticas de descarte são decisão futura.
