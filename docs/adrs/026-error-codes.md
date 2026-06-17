# ADR-026: Erros com código traduzível (i18n no backend)

## Status

Aceito — implementado (2026-06-17). Todos os módulos migrados (Identity, Knowledge, Ingestion, Retrieval, Consumption, Audit + shared kernel); cada edge serializa via `toErrorResponse` e o `statusForError` por substring foi removido.

## Data

2026-06-17

## Contexto

A SPA foi internacionalizada (ADR-025), mas o backend devolvia a **mensagem de erro em inglês hardcoded** (`{ "error": "A collection with this name already exists" }`), que a UI exibia crua — sem como traduzir. Além disso, o edge escolhia o **status HTTP por casamento de substring** da mensagem (`statusForError`: contém "not found"/"already"/"Invalid"… ⇒ 400) — frágil e acoplado ao texto. Precisamos que o backend devolva um **token estável (enum/chave de tradução)** para o front traduzir.

## Decisão

**Erros de domínio carregam um código estável; o edge serializa código + status + fallback; a SPA traduz o código.**

- **`DomainError(code, kind, params?, message?)`** (shared kernel): `code` é a chave estável (ex.: `knowledge.collectionNameExists`); `kind` é a categoria semântica; `params` alimenta interpolação na UI (ex.: `{ id }`); `message` é o **fallback em inglês** (logs/clientes não-i18n). Erros de aplicação herdam de `DomainError` (ex.: `UnauthorizedError` → code `common.forbiddenRole`).
- **`kind` → status HTTP** numa tabela no edge (`httpStatusForKind`): `validation` 400, `unauthorized` 401, `forbidden` 403, `not_found` 404, `conflict` 409, `unavailable` 503, `internal` 500 — substitui o casamento por substring. Os `kind` foram escolhidos para **preservar os status atuais** (a maioria dos erros de domínio era 400 ⇒ `validation`); este ADR é sobre códigos, não sobre reescrever status.
- **Formato da resposta** (contrato, todas as superfícies — SPA, `/v1`, MCP): `{ "error": "<code>", "message": "<inglês>", "params"?: {...} }`. O campo `error` passa a ser o **código**; `message` permanece como fallback humano. `toErrorResponse(error)` no edge é a única fonte desse shape; um erro não-`DomainError` vira `{ error: "common.unexpected", message }` (500).
- **Frontend:** `ApiError` carrega `code`/`params`; `ErrorNotice` faz `t("errors." + code, { ...params, defaultValue: message })` — um código **sem tradução cai no `message` em inglês** do backend (degradação graciosa), então a cobertura pt-BR pode ser preenchida incrementalmente. Um `401` continua tratado como "sessão expirou" (UX do cliente), independente do código.
- **Abrangência:** todos os módulos. O backend **não** roda i18n — ele só emite código + inglês; a tradução é responsabilidade da SPA (mantém o backend simples e os códigos servem também consumidores de máquina do `/v1`/MCP).

## Consequências

**Positivas:**

- UI traduz erros de verdade (ADR-025); chaves estáveis também ajudam consumidores de máquina.
- Status HTTP deixa de depender do texto da mensagem (sem `statusForError` por substring).
- Degradação graciosa: código sem tradução exibe o `message` em inglês; cobertura pt-BR incremental.

**Negativas:**

- Disciplina: todo `throw` de domínio precisa de um código + kind; ~97 sites migrados.
- Dois lugares para a "mensagem" de um erro: o `message` inglês (backend) e a tradução (front) — mantidos alinhados pela chave.

**Neutras:**

- Backend permanece sem i18n; só a SPA traduz.
- O `message` inglês continua disponível para logs e clientes que não traduzem.

## Regras Derivadas

- Erros de domínio/aplicação lançam `DomainError(code, kind, params?, message?)`, nunca `Error("prosa em inglês")` voltada ao usuário.
- O edge serializa via `toErrorResponse`; `kind` define o status (sem casar substring).
- `error` = código estável; `message` = fallback em inglês; a SPA traduz `errors.<code>` com fallback no `message`.
- Erros internos de programação (guardas) podem continuar como `Error` cru → viram `common.unexpected` (500).
