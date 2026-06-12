# ADR-002: Decorators via experimentalDecorators + SWC

## Status

Aceita

## Contexto

Decorators sao uteis para cross-cutting concerns como logging, metricas e autorizacao.
Existem duas variantes:

1. **Legacy TypeScript decorators** (`experimentalDecorators: true`) - API madura, usada por NestJS/Angular
2. **TC39 Stage 3 decorators** - padrao JavaScript futuro, assinatura `(target, context)`

TC39 Stage 3 decorators nao sao suportados nativamente pelo V8 no Node.js 24, nem pelo
type stripping nativo, nem pelo `--experimental-transform-types`.

## Decisao

Usar **`experimentalDecorators: true`** com **`@swc-node/register`** para transformacao on-the-fly.

**Configuracao:**

- `tsconfig.json`: `experimentalDecorators: true`
- Runtime: `node --import @swc-node/register/esm-register`
- SWC transforma decorators para JavaScript puro antes da execucao
- Sem etapa de build em disco (transformacao em memoria)

**Assinatura (legacy):**

```typescript
function log(target: object, propertyKey: string, descriptor: PropertyDescriptor): void;
function log(options: LogOptions): MethodDecorator;
```

**Uso:**

```typescript
class MyService {
  @log
  doWork() { ... }

  @log({ level: "debug" })
  debugWork() { ... }
}
```

## Alternativas Consideradas

| Alternativa                       | Por que descartada                      |
| --------------------------------- | --------------------------------------- |
| TC39 Stage 3 nativo               | V8 no Node.js 24 nao suporta `@` syntax |
| TC39 com aplicacao programatica   | Funciona mas perde a ergonomia do `@`   |
| Build step completo (tsc/esbuild) | Adiciona complexidade desnecessaria     |

## Consequencias

**Positivas:**

- Sintaxe `@log` funciona nativamente nos arquivos `.ts`
- Compativel com ecossistema (NestJS, Angular, TypeORM)
- Transformacao on-the-fly via SWC (sem build em disco)
- Type checking funciona (`tsc` valida os decorators)

**Negativas:**

- Dependencia de `@swc-node/register` e `@swc/core` em devDependencies
- Usa API legacy (nao TC39 Stage 3)
- Startup ligeiramente mais lento que type stripping nativo (~300ms)
