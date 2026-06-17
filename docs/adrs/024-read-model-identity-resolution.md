# ADR-024: Resolução de Identidade na Borda de Leitura

## Status

Aceito — implementado (commit `5d9130c`, 2026-06-17)

## Data

2026-06-17

## Contexto

A validação E2E (ver [[../../README.md]] / histórico) deixou duas lacunas de UX de **leitura**, ambas sobre exibir identidade legível para humanos:

1. **UUIDs crus em read models.** O histórico de versões mostrava o autor (`createdBy`) e a trilha de auditoria mostrava o ator (`actorId`) como UUIDs. O nome vive no contexto **Identity** (tabela `users`). Resolver no cliente não funciona: as personas que consomem essas telas — **curator** (versões) e **auditor** (auditoria) — **não** podem ler o roster (`GET /organizations/:id/users` exige `admin`, ADR-011). Logo a resolução tem de ser **server-side**, sem o read model do Knowledge/Audit importar o agregado `User`.
2. **Tela de aceite de convite sem contexto.** `/#/invitations/:token` pedia uma senha sem dizer **qual organização** convidou, para **qual e-mail** e com **quais papéis**. O convidado ainda não está autenticado, então não há Actor Context para uma leitura normal — só o próprio token.

## Alternativas Consideradas

### A. Resolução de nomes

1. **Join cru no adapter de leitura** (Audit/Knowledge fazem `JOIN users`). Prós: uma query. Contras: acopla a infra de um contexto ao schema de outro — fura o hexágono (a checagem de pré-commit proíbe), e o contexto passa a conhecer a tabela alheia.
2. **Endpoint de roster reusado no cliente.** Contras: é `admin`-only; curator/auditor tomam 403. Exporia o roster inteiro a quem não deveria. Inviável.
3. **Porta transversal `UserDirectoryPort` + enriquecimento no caso de uso (escolhida).** Identity provê o adapter (dono da tabela `users`); Knowledge/Audit dependem só da interface no shared kernel. Mesmo padrão do `OrganizationPolicyPort` (ADR-013).

### B. Contexto do convite

1. **Embutir org/papéis no próprio token** (JWT-like). Contras: token deixa de ser opaco; dado fica preso no momento do convite; maior superfície. Contraria a ADR-010 (segredos opacos).
2. **Endpoint público `GET /invitations/:token` que descreve o convite pendente (escolhida).** O token já é o segredo portador (mesmo do `accept`); devolve o **mínimo** (nome da org, e-mail convidado, papéis) e nada mais.

## Decisão

**A — `UserDirectoryPort` (shared kernel).** Porta de leitura transversal: `resolveDisplayNames(userIds) → Map<id, nome>`. O `UserDirectoryAdapter` do Identity resolve **dentro do escopo de tenant do Actor Context** (reusa `UserRepositoryPort.listByCompany`); ids desconhecidos, de outro tenant ou não-humanos (system/operator) simplesmente **não aparecem** no mapa. `GetVersionHistoryUseCase` e `ListAuditTrailUseCase` coletam os ids distintos, resolvem **em lote** (sem N+1) e enriquecem as views com `createdByName` / `actorName`; **null ⇒ a UI cai no id**. A auditoria separa `AuditEventRecord` (o que a porta retorna) de `AuditEventView` (+`actorName`). Consumidores que reusam uma query de leitura **só pelo conteúdo** (a projeção do Retrieval lê versões só pelo corpo) recebem um `NullUserDirectory` e não dependem do Identity.

O **agregado** da auditoria continua um **id cru, por decisão**: numa trilha forense o identificador estável é a chave certa, e o agregado é heterogêneo (item, usuário, credencial, coleção…). Resolve-se o "quem" (ator), não o "o quê".

**B — `GET /invitations/:token`** (público, pré-auth). `DescribeInvitationUseCase` roda em escopo `system` (leitura privilegiada/sem filtro), faz hash do token e acha o usuário convidado; devolve `{ organizationName, email, roles }` **só** se a convite estiver **pendente** (`status === "invited"`); token desconhecido ou já usado ⇒ `null` ⇒ **404**. A `AcceptInvitationPage` busca isso no mount e mostra "Join {org}" + e-mail + papéis, ou um card "Invitation not found".

## Consequências

**Positivas:**

- Nomes legíveis nas telas sem furar o hexágono nem exigir papel de admin; a direção de dependência aponta Identity → porta do shared kernel.
- Resolução em lote (sem N+1); fail-safe (não resolveu ⇒ mostra o id).
- O convidado vê o que está aceitando antes de criar a senha; nada além do mínimo é exposto pré-auth.

**Negativas:**

- Mais uma porta transversal para manter; cada novo read model que queira nomes precisa injetar o `UserDirectory` (ou o `Null`).
- `GET /invitations/:token` é uma superfície pública nova — mantida fail-closed e com payload mínimo.

**Neutras:**

- O agregado da auditoria segue como id; resolver título/rótulo por tipo de agregado fica para depois, se houver demanda.
- `actorName`/`createdByName` são derivados em tempo de leitura (refletem o nome atual do usuário, não o do momento do evento) — desejável para esse uso de UI.

## Regras Derivadas

- Para exibir o nome de um usuário num read model, resolva **server-side** via `UserDirectoryPort` (adapter do Identity, tenant-scoped); **nunca** busque o roster admin-only de uma tela não-admin.
- Enriquecimento de nomes é em **lote** no caso de uso; `null` ⇒ a UI cai no id (sem quebrar).
- A trilha de auditoria resolve o **ator**, não o **agregado** (id forense estável).
- Leitura pré-auth por token é fail-closed (404 fora de pendente) e expõe o **mínimo** necessário.
