# ADR-001: Native Type Stripping (sem compilacao)

## Status

Aceita

## Contexto

Projetos TypeScript tradicionalmente requerem uma etapa de compilacao (tsc, esbuild, swc)
para gerar JavaScript executavel. Isso adiciona complexidade na configuracao, no CI e no
desenvolvimento local.

Node.js 22+ introduziu `--experimental-strip-types` que remove anotacoes de tipo em runtime
sem transpilar o codigo. Node.js 24 estabilizou esse comportamento como default.

## Decisao

Usar Node.js 24 com type stripping nativo. O TypeScript roda diretamente via `node arquivo.ts`
sem nenhuma etapa de build.

**Configuracao:**

- `tsconfig.json` com `noEmit: true` (apenas type checking)
- `verbatimModuleSyntax: true` (imports de tipo explicitamente marcados)
- `module: nodenext` (resolucao nativa do Node.js)
- Sem bundler, sem transpiler, sem etapa de build

**Restricoes:**

- Enums do TypeScript **nao** sao suportados (usar union types ou objetos const)
- Namespaces **nao** sao suportados
- TC39 decorators com sintaxe `@` **nao** sao suportados nativamente no V8 do Node.js 24
  (ver ADR-002 para a solucao adotada)

## Consequencias

**Positivas:**

- Zero configuracao de build
- Tempo de startup mais rapido
- Menos dependencias no projeto
- Menos divergencia entre codigo fonte e codigo executado

**Negativas:**

- Limitado a features que o Node.js consegue executar via type stripping
- Erros de tipo so sao detectados via `tsc` (typecheck), nao em runtime
