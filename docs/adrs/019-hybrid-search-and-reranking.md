# ADR-019: Hybrid Search & Reranking

## Status

Proposto

## Data

2026-06-16

## Contexto

A recuperação da PRD-4 precisa combinar busca **vetorial** (`pgvector`, ADR-018) com busca **léxica** (full-text do Postgres) e decidir se acrescenta um **reranker** cross-encoder. Dois fatos do domínio guiam a decisão de reranking: o **consumidor é uma IA** (entregamos contexto; a IA dele raciocina sobre o top-K — ordenação fina no topo importa menos que recall + conjunto limpo), e o **corpus por tenant é curado e pequeno-a-médio** (pouca duplicata, justamente onde reranker brilha). Além disso, já devolvemos **atribuição + frescor/confiança** por resultado, então a IA consumidora tem sinais para ponderar relevância por conta própria.

## Alternativas Consideradas

### 1. Busca só-vetorial (ou só-léxica)

Um único recuperador.

- **Prós:** o mais simples.
- **Contras:** vetorial perde match de termo exato/raro; léxica perde paráfrase/semântica; cada uma sozinha é mais fraca (o golden-set da PRD-4 espera que híbrida vença).

### 2. Híbrida com combinação ponderada de scores

Normaliza e soma scores vetorial + léxico com pesos.

- **Prós:** ajustável.
- **Contras:** distância vetorial e `ts_rank` são escalas **incomparáveis**; exige normalização e calibração de pesos por corpus; frágil.

### 3. Híbrida com Reciprocal Rank Fusion (RRF) (escolhida)

Funde as duas listas por **rank**, não por score.

- **Prós:** sem normalização de escala; robusto; quase sem parâmetro; composável **numa query só** no Postgres (pgvector + FTS).
- **Contras:** ignora a magnitude do score (só rank); tem uma constante de tuning (k), menor.

## Decisão

Escolhida a **alternativa 3**: busca híbrida via **RRF, composta in-DB** (ranking de distância do `pgvector` + ranking `ts_rank` do full-text do Postgres, fundidos por reciprocal rank).

**Reranking fica adiado.** Na v1 existe apenas a **abstração `RerankerPort`, desligada** — o cross-encoder (`bge-reranker-v2-m3`, par natural do bge-m3) **não é implementado**. Justificativa de domínio: o consumidor é um LLM que lê o top-K e raciocina (ordenação fina vale menos que recall + conjunto limpo); o corpus é curado e pequeno (pouca ambiguidade de quase-duplicatas); e já entregamos atribuição + frescor/confiança para a IA consumidora ponderar. O reranker só é ligado **quando um golden-set sobre corpus real provar** que a precisão da híbrida é insuficiente — aí o custo (latência em query-time + 2º modelo no caminho quente) se paga.

Todo resultado carrega **atribuição + frescor/confiança** (invariante da PRD-4). Toda busca é **obrigatoriamente filtrada** por `companyId` + `RetrievalScope`; sem escopo ⇒ sem resultados.

## Consequências

**Positivas:**

- Híbrida robusta sem calibrar escalas; viável numa query única no Postgres (ADR-018).
- v1 enxuta: nenhum segundo modelo no caminho quente da busca.
- A `RerankerPort` mantém a porta aberta sem custo; alinhado ao modelo "damos contexto, a IA do consumidor raciocina".

**Negativas:**

- RRF ignora a magnitude do score (só rank) — aceitável, mas é uma perda de informação.
- Adiar o reranker significa que, se a precisão da híbrida for insuficiente em algum corpus, a qualidade do top-k fica menor até ligarmos (aceito, condicionado a medição).
- A `RerankerPort` fica como código inerte até ser ligada (custo pequeno).

**Neutras:**

- O modelo de rerank (`bge-reranker-v2-m3`) já está identificado para quando for ligado.
- O golden-set é o gatilho objetivo da decisão de ligar.

## Regras Derivadas

- Híbrida = RRF sobre `pgvector` + full-text do Postgres, composta in-DB.
- Reranking mora atrás da `RerankerPort`, **desligado na v1**, ligado só sob necessidade medida (golden-set).
- Todo resultado carrega atribuição + frescor/confiança.
- Toda busca é filtrada por `companyId` + `RetrievalScope`; escopo vazio ⇒ resultado vazio.
