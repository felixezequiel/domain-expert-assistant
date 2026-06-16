# ADR-017: Local Embedding & Chunking

## Status

Proposto

## Data

2026-06-16

## Contexto

A PRD-4 precisa gerar embeddings **locais, gratuitos e multilíngues** (Transformers.js/ONNX, sem API paga) para alimentar o `pgvector` (ADR-018), e de uma **estratégia de chunking** (movida da PRD-3) — que é acoplada à janela de tokens do modelo, por isso decididas juntas. Uma passada de pesquisa (junho/2026) comparou os candidatos com ONNX disponível para Transformers.js, dimensionalidade (cabe no limite ~2000 do índice pgvector), janela de tokens, cobertura de idiomas, tamanho/latência e licença. O tamanho do chunk também interage com a decisão de reranking (ADR-019), que para a v1 fica **desligada**.

## Alternativas Consideradas

### 1. BGE-M3 (`Xenova/bge-m3`) (escolhida)

1024 dimensões, janela de **8192 tokens**, 100+ idiomas, licença MIT, ONNX oficial maduro.

- **Prós:** janela longa (não força fragmentar seções coerentes); **sem prefixo** `query:`/`passage:` (um lugar a menos pra errar o pipeline); baseline multilíngue provado; MIT (ok comercial).
- **Contras:** mais pesado (~1,1 GB em fp16); 1024-dim custa ~25% mais storage/índice que um 768.

### 2. gte-multilingual-base (`onnx-community/gte-multilingual-base`)

768 dimensões, janela de 8192 tokens, 70+ idiomas, Apache-2.0, encoder rápido.

- **Prós:** storage e latência menores; janela longa.
- **Contras:** exige **prefixo de instrução na query** (mais um ponto de erro); menos idiomas.

### 3. Família multilingual-e5 (`Xenova/multilingual-e5-*`)

MIT, provada, variantes small/base/large.

- **Prós:** variantes pequenas; bem estabelecida.
- **Contras:** janela de só **512 tokens** (força chunking agressivo + mais vetores); prefixo `query:`/`passage:` obrigatório; mais antiga.

## Decisão

Escolhida a **alternativa 1**: **BGE-M3 em fp16**, via **`@huggingface/transformers` v3** (oficial e mantido — **não** o legado `@xenova/transformers`), atrás de um `EmbedderPort`. A dimensão de embedding é **1024** (coluna `pgvector`, bem abaixo do limite de índice). Fallback documentado: **gte-multilingual-base**, se latência de CPU ou storage se tornarem o gargalo (aceitando o prefixo de query dele).

**Chunking: structure-aware + orçamento de tokens + overlap pequeno.** Quebrar primeiro pela estrutura do documento (headings/parágrafos), depois empacotar até um orçamento (~512 tokens para começar, ajustável), com sobreposição pequena entre chunks. Não usar tamanho fixo cego (corta ideias no meio) nem chunking semântico (exigiria outro modelo). A janela de 8192 garante que **nunca somos forçados** a fragmentar uma seção coerente — mas, como a v1 **não tem reranker** (ADR-019) para consertar precisão em query-time, **pendemos para chunks modestos e precisos**; se o reranker for ligado depois, revisitamos o tamanho para cima.

A escolha do modelo deve ser **validada num golden-set sobre corpus real** antes de travar — a pesquisa não conseguiu uma tabela única autoritativa de scores e múltiplas fontes recomendam benchmark no próprio corpus.

## Consequências

**Positivas:**

- Embedding multilíngue, gratuito e local; janela longa; sem complexidade de prefixo; cabe no `pgvector` e na máquina de dev.
- Chunking coerente, ajustável, alinhado à v1 sem reranker (favorece precisão).
- `EmbedderPort` permite trocar o modelo sem tocar o resto.

**Negativas:**

- BGE-M3 é mais pesado e 1024-dim custa mais storage/índice que um 768.
- Embedding é custo de CPU/GPU no index-time (assíncrono, ADR-020 — aceitável, mas existe).
- O tamanho do chunk é heurística e exige calibração em corpus real.

**Neutras:**

- Fallback (gte) documentado para o caso de latência/storage apertarem.
- Escolha de runtime fixada (`@huggingface/transformers` v3), distinta do legado.

## Regras Derivadas

- Embeddings sempre via `EmbedderPort`; default v1 = BGE-M3 fp16 em `@huggingface/transformers` v3.
- Dimensão de embedding = 1024, fixada na coluna `pgvector`.
- Chunking é structure-aware + orçamento ~512 tokens + overlap pequeno, favorecendo precisão enquanto não há reranker.
- Com BGE-M3 não se adiciona prefixo de query; validar o modelo em golden-set antes de travar.
