# ADR-025: Internacionalização (i18n) da SPA

## Status

Aceito — fundação implementada (commit `bfee192`, 2026-06-17); migração das telas em andamento.

## Data

2026-06-17

## Contexto

A SPA de Curadoria & Admin (ADR-023) era 100% em inglês, hardcoded no JSX. O produto precisa ser **bilíngue: pt-BR (padrão) e en-US**, com troca de idioma pelo usuário, sem reescrever as telas a cada novo texto. Restrições: a SPA é self-contained/same-origin (sem chamadas externas), e há uma grande suíte de testes que hoje afirma os textos **em inglês**.

## Alternativas Consideradas

### 1. Sem lib — um dicionário próprio + Context

- **Prós:** zero dependência.
- **Contras:** reinventar interpolação, plural, fallback, troca reativa de idioma; mais código e bugs. Desperdício.

### 2. `react-i18next` (i18next) (escolhida)

Padrão de mercado para React: hook `useTranslation`, interpolação, fallback, troca reativa, recursos em JSON.

- **Prós:** maduro, ergonômico (`t("chave")`), recursos podem ser **bundlados** (sem backend/CDN — coerente com a SPA offline/same-origin).
- **Contras:** uma dependência a mais; exige disciplina de chaves.

### Estrutura de recursos: arquivo único por locale vs. um arquivo por seção

Um arquivo gigante por locale gera conflito quando várias frentes traduzem em paralelo. **Escolhido: um arquivo JSON por área** (`common`, `nav`, `auth`, `dashboard`, `knowledge`, `review`, `audit`, `consumer`, `admin`) por locale, fundidos num único namespace `translation` por um `index.ts` — paraleliza a migração sem conflito de arquivo.

## Decisão

**`react-i18next` com dois locales, pt-BR como padrão.**

- **Locales:** `pt-BR` (default) e `en-US`. Idioma escolhido **persistido em `localStorage`**; `LanguageSwitcher` (topo) alterna; `lng` inicial = persistido ∨ `pt-BR`; `<html lang>` reflete o idioma.
- **Recursos bundlados** (sem backend/CDN): JSON por seção em `src/i18n/locales/<lng>/<section>.json`, fundidos em um namespace `translation`, **chaves pontilhadas** (`t("nav.links.home")`). Genéricos em `common` (ações, `status.<lifecycle>`, sensibilidade, papéis, erros); chrome em `nav`.
- **Sem string de UI hardcoded:** todo texto visível passa por `t(...)`. `ErrorNotice`/`AsyncBoundary` traduzem os 401/403/loading genéricos uma vez; mensagens vindas do servidor (inglês) são exibidas como estão.
- **`en-US` = cópia verbatim** dos textos originais. Os testes são **fixados em en-US** (`src/test/setup.ts` inicializa o i18n após fixar o idioma), então as asserções em inglês continuam válidas sem reescrever a suíte.
- **Datas** formatadas no idioma ativo (`lib/format.ts` usa `i18n.language`).
- **Não traduzido:** mensagens de erro do backend (o servidor é inglês), valores de enum (status/sensibilidade/papel mantêm o valor; só o **rótulo** é traduzido via `common.*`).

## Consequências

**Positivas:**

- App bilíngue, padrão pt-BR, troca instantânea e persistente; chaves centralizadas.
- Migração paraleliza (um arquivo por seção); suíte de testes intacta (en-US fixado).
- SPA continua self-contained (recursos bundlados, sem CDN).

**Negativas:**

- Disciplina: todo texto novo precisa de chave + tradução nos dois locales; faltou tradução ⇒ cai no `fallbackLng` (pt-BR).
- Migração das telas é ampla e foi feita em ondas (chrome primeiro; páginas por área depois).

**Neutras:**

- Backend permanece em inglês (mensagens de erro/eventos); só a UI é i18n.
- Adicionar um terceiro idioma = mais um conjunto de arquivos de seção, sem mudança estrutural.

## Regras Derivadas

- Nenhuma string de UI hardcoded; sempre `t("section.key")` com `useTranslation`.
- `en-US` é a cópia verbatim do texto original; testes rodam em en-US (pin em `src/test/setup.ts`).
- Genéricos (ações, status, sensibilidade, papéis, erros) vêm de `common`; específicos vão na seção da área.
- Recursos são bundlados (sem backend/CDN); um arquivo JSON por área por locale.
- Datas e números formatam no `i18n.language`.
