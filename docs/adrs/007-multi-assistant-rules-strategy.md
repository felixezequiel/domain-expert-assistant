# ADR-007: Estrategia Multi-Assistente para Regras de Engenharia

## Status

Aceita

## Contexto

O template precisa enforcar suas praticas de engenharia (TDD, ADR, Hexagonal,
Readable Code, PlainObject, etc.) independentemente de qual assistente de IA
esteja sendo usado pelo desenvolvedor: Claude Code, Cursor, Windsurf, Cline,
Continue, Aider, GitHub Copilot, Codex CLI, entre outros.

Cada assistente le formatos diferentes:

- **Claude Code** le `.claude/skills/<name>/SKILL.md` (Ring format YAML+MD) e `CLAUDE.md`
- **Cursor** le `.cursor/rules/*.mdc` (formato proprio com `globs` e `alwaysApply`); le `AGENTS.md` mas nao trata como regra
- **Windsurf** le `.windsurf/rules/*.md`
- **Cline** le `.clinerules/` (arquivos `.md`)
- **Continue** le `.continue/rules/*.md`
- **Aider** le arquivos referenciados via `--read` (convencao: `CONVENTIONS.md`)
- **GitHub Copilot** le `.github/copilot-instructions.md`
- **Codex CLI / Zed** seguem `AGENTS.md`

Sem adapters por assistente, agentes como Cursor tratam o que esta em `AGENTS.md`
como contexto de baixa prioridade e acabam improvisando codigo que viola as regras
do template (foi o que motivou esta ADR).

A enforce deterministica ja existe via git pre-commit (`scripts/precommit.mjs`) que
roda independente do agente. Essa camada bloqueia commits que violam TDD/Hexagonal/
PlainObject. Mas no momento da escrita do codigo, o agente precisa **conhecer** as
regras para nao gerar codigo que sera bloqueado depois — caso contrario o
desenvolvedor precisa corrigir manualmente cada commit rejeitado.

## Alternativas Consideradas

### 1. Adapters duplicados manualmente

Manter copias paralelas das regras em cada formato (`.cursor/rules/`,
`.windsurf/rules/`, `.clinerules/`, etc.), atualizadas manualmente.

**Pros:** Zero ferramental novo. Cada adapter pode ser otimizado para o estilo do
agente.

**Cons:** Drift inevitavel — atualizar uma skill e esquecer dos N-1 adapters. O
template nasce com 13 skills e 6+ assistentes, total de 78+ arquivos para manter
sincronizados.

### 2. Apenas `AGENTS.md` consolidado

Concentrar tudo em `AGENTS.md` e confiar que cada agente le. Adicionar mais detalhes
inline para reduzir improvisacao.

**Pros:** Single source verdadeiro, sem ferramental.

**Cons:** Cursor/Windsurf nao tratam `AGENTS.md` como regra obrigatoria — apenas como
contexto. Continuariam improvisando. Comprovado empiricamente (Cursor inventou
implementacoes que violavam as skills mesmo com `AGENTS.md` presente).

### 3. Gerador de adapters a partir de `.claude/skills/`

`.claude/skills/*/SKILL.md` sao a single source of truth. Um script
`scripts/sync-rules.mjs` le os skill files e gera os adapters de cada assistente
(`.cursor/rules/`, `.windsurf/rules/`, `.clinerules/`, `.continue/rules/`,
`CONVENTIONS.md`). O script roda no `prepare` (npm install) e pode ser chamado
manualmente via `npm run sync:rules`.

**Pros:** Single source of truth preservada. Drift impossivel — adapters sao
regenerados automaticamente. Cada agente recebe as regras no formato que ele
prioriza. Adicionar suporte a um novo assistente e adicionar um output target no
gerador — sem tocar nas skills.

**Cons:** Adiciona um script (~200 linhas) ao template. Devs precisam rodar
`npm run sync:rules` se editarem skills sem `npm install`. Adapters gerados sao
artefatos commitados (necessario, ja que assistentes precisam le-los antes de
qualquer comando rodar).

## Decisao

Adotar a alternativa 3: **gerador `scripts/sync-rules.mjs` com `.claude/skills/`
como single source of truth**.

**Convencoes:**

- O gerador le `.claude/skills/*/SKILL.md`, parsea o frontmatter YAML (parser
  minimo, sem dependencia externa) e o body markdown.
- Para cada assistente, gera um diretorio (ou arquivo unico no caso do Aider)
  com o conteudo no formato esperado.
- Skills com `trigger` contendo "Always" (always-active) viram `alwaysApply: true`
  no Cursor e equivalentes nos demais.
- Skills com `trigger` contextual recebem `globs` apropriados (mapeamento explicito
  no script — ex: `tdd-workflow` -> `**/*.ts` exceto `*.test.ts`).
- Os adapters gerados ficam commitados no repositorio para que o assistente os
  leia desde o primeiro clone.
- Header gerado declara explicitamente "AUTO-GENERATED — edit `.claude/skills/`
  instead" para evitar edicao manual.

**Outputs do gerador:**

| Assistente | Destino | Formato |
| --- | --- | --- |
| Cursor | `.cursor/rules/<skill>.mdc` | MDC (YAML + body) |
| Windsurf | `.windsurf/rules/<skill>.md` | MD com header `<!-- trigger: ... -->` |
| Cline | `.clinerules/<skill>.md` | MD plano |
| Continue | `.continue/rules/<skill>.md` | MD plano |
| Aider | `CONVENTIONS.md` | MD consolidado |
| Codex / Zed | `AGENTS.md` | Mantido manual (ja existe) |
| Copilot | `.github/copilot-instructions.md` | Mantido manual (ja existe) |

A camada deterministica (pre-commit) permanece como rede de seguranca para
garantir que mesmo se um agente ignorar todas as regras, o commit nao passa.

## Consequencias

**Positivas:**

- Single source of truth real. Editar uma skill atualiza todos os assistentes.
- Cobertura de assistentes mais usados sem custo de manutencao por agente.
- Onboarding novo dev em qualquer IDE/editor com mesmas regras.
- Pre-commit continua sendo a rede final de protecao.

**Negativas:**

- Adapters gerados ficam commitados — diff em PRs as vezes pode incluir lixo
  generated. Mitigacao: header claro e CI que roda `sync:rules` para detectar
  divergencia entre skills e adapters.
- Devs que editam skills precisam rodar `sync:rules` antes de commitar. Mitigacao:
  hook `prepare` no `package.json` regenera no `npm install`; documentacao explicita.
- Parser YAML simples pode quebrar com sintaxe avancada. Mitigacao: skills usam
  formato estavel (chaves planas + pipe blocks); gerador valida e falha cedo.

**Neutras:**

- Adicionar suporte a um novo assistente requer mudar apenas o gerador, nao as
  skills.

## Regras Derivadas

- **NUNCA editar manualmente** arquivos em `.cursor/rules/`, `.windsurf/rules/`,
  `.clinerules/`, `.continue/rules/`, ou `CONVENTIONS.md` — eles sao regenerados.
- **SEMPRE editar `.claude/skills/<name>/SKILL.md`** quando uma regra mudar.
- **SEMPRE rodar `npm run sync:rules`** apos editar skills (o `prepare` faz isso
  no install).
