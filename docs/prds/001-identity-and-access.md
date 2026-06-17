# PRD-1: Identity & Access

| Campo      | Valor                              |
| ---------- | ---------------------------------- |
| Status     | Proposto                           |
| Fase       | v1                                 |
| Contexto   | Identity & Access (bounded context)|
| Depende de | PRD-0                              |

## 1. Objetivo & valor

Definir **quem existe** no sistema e **o que cada um pode fazer**. Sustenta o multi-tenant (organizações isoladas), os humanos que operam a curadoria (5 personas) e as **credenciais de máquina** que os consumidores de IA usam para acessar o conhecimento — com escopo de acesso (coleções + teto de sensibilidade) que o resto do produto vai respeitar.

## 2. Escopo

**Inclui:**
- Agregado `Organization` (tenant) provisionado pelo operador, com política de governança (`requireSeparateReviewer`).
- Agregado `User` (humano) com papéis: **Admin, Curator, Reviewer, Auditor, Consumer (humano)**. Papéis aditivos.
- Convite de usuário + ativação + **login email+senha** + sessão revogável (mecanismo → ADR-010).
- Agregado `ConsumerCredential` (API key de máquina) com escopo `{collectionIds[], sensitivityCeiling}`, emissão, rotação e revogação.
- Autorização: papéis (humanos) e escopo (consumidores) governam o que cada um pode fazer (modelo → ADR-011).

**Não inclui (fora da v1):**
- SSO/OAuth corporativo.
- Signup self-service e billing/cotas.
- OAuth2 client-credentials para consumidores (só API key na v1).
- Suspensão de organização: a org nasce `active` e não há operação de suspender na v1 (o status fica como ponto de extensão futuro).

## 3. Personas
- **Admin** — gerencia usuários, papéis, coleções (cria — ver PRD-2), credenciais de consumidor e a política da organização.
- **Curator/Expert**, **Reviewer**, **Auditor**, **Consumer humano** — definidos aqui como papéis; usados nos PRDs 2/5/6.

## 4. Linguagem ubíqua
| Termo | Significado |
|---|---|
| **Organization** | O tenant. Raiz de isolamento. |
| **User** | Pessoa autenticada por email+senha, pertence a 1 organização, tem ≥1 papel. |
| **Role** | Admin / Curator / Reviewer / Auditor / Consumer (humano). Aditivos. |
| **Invitation** | Convite pendente para um email virar `User` ativo. |
| **ConsumerCredential** | Chave de API de uma integração/IA consumidora. Tem `keyPrefix` + segredo hasheado, escopo e status. |
| **Scope** | `{collectionIds[], sensitivityCeiling}` de uma credencial. |
| **Sensitivity Ceiling** | Nível máximo de sensibilidade que a credencial pode ler (`público|interno|confidencial`). |

## 5. Modelo de domínio

### Agregado `Organization`
- `OrganizationId`, `name`, `status` (`active`; suspensão fora da v1 — ver §2), `policy: { requireSeparateReviewer: boolean }`, `createdAt`.
- Invariante: nome único por instalação; política default `requireSeparateReviewer = true`.

### Agregado `User`
- `UserId`, `companyId`, `email` (VO, único por org), `passwordHash`, `displayName`, `roles: Set<Role>` (≥1), `status` (`invited|active|disabled`).
- Invariantes: email válido e único por org; usuário ativo tem `passwordHash`; não pode ficar sem papéis; não dá para desabilitar o último Admin da org.

### Agregado `ConsumerCredential`
- `CredentialId`, `companyId`, `name`, `keyPrefix`, `secretHash`, `scope: { collectionIds: CollectionId[], sensitivityCeiling: SensitivityLevel }`, `status` (`active|revoked`), `lastUsedAt?`, `createdBy`.
- Invariantes: segredo só exibido **uma vez** na emissão (depois só hash); credencial revogada não autentica; escopo referencia coleções existentes da própria org.

### Value Objects
- `Email`, `Password`/`PasswordHash`, `Role` (enum), `SensitivityLevel` (`público<interno<confidencial`, ordenável), `CredentialScope`.

## 6. Domain Events
`OrganizationProvisioned`, `OrganizationPolicyChanged`, `UserInvited`, `UserActivated`, `UserRolesChanged`, `UserDisabled`, `ConsumerCredentialIssued`, `ConsumerCredentialRotated`, `ConsumerCredentialRevoked`.
> Todos carregam `companyId` + `actorId` (via PRD-0) → auditáveis.

## 7. Casos de uso

| Caso de uso | Ator | Regras |
|---|---|---|
| `ProvisionOrganization` | Operador (sistema) | Cria org + primeiro Admin. Único caminho sem signup. |
| `InviteUser` | Admin | Email único na org; gera convite. |
| `AcceptInvitation` | Convidado | Define senha → vira `active`. |
| `Authenticate` (login) | Humano | Email+senha → token; falha não revela se email existe. |
| `ChangeUserRoles` | Admin | Não remove último Admin. |
| `DisableUser` | Admin | Não desabilita último Admin. |
| `SetOrganizationPolicy` | Admin | Liga/desliga `requireSeparateReviewer`. |
| `IssueConsumerCredential` | Admin | Define escopo; retorna segredo **uma vez**. |
| `RotateConsumerCredential` | Admin | Novo segredo, mesmo escopo. |
| `RevokeConsumerCredential` | Admin | Status → revoked. |
| `AuthenticateConsumer` | Sistema | Resolve API key → credencial ativa + escopo (usado pelo PRD-5). |

## 8. Contratos (REST — humanos)
```
POST /auth/login                          # email+senha → token
POST /organizations/:orgId/users/invite   # Admin
POST /invitations/:token/accept           # define senha
PUT  /users/:userId/roles                 # Admin (full-replace of the role set, not PATCH)
POST /users/:userId/disable               # Admin
PUT  /organizations/:orgId/policy         # Admin (full-replace of the policy, not PATCH)
POST   /credentials                       # Admin — emite (retorna segredo 1x)
POST   /credentials/:id/rotate            # Admin
DELETE /credentials/:id                   # Admin — revoga
GET    /credentials                       # Admin — lista (sem segredo)
```
Provisionamento de organização: endpoint/CLI **interno** do operador (fora da superfície pública).

## 9. Persistência
- Schemas `organizations`, `users`, `consumer_credentials` — todas tenant-scoped (exceto `organizations`, que É o tenant) com `company_id` + `CompanyFilter` (PRD-0).
- Segredos: apenas hash + `keyPrefix` (para lookup rápido). Nunca persistir segredo em claro.

## 10. Critérios de aceite
- [ ] Operador provisiona org + primeiro Admin; ninguém de fora cria org.
- [ ] Login com senha errada e email inexistente retornam erro indistinguível.
- [ ] API key emitida autentica; após `revoke`, não autentica mais.
- [ ] Segredo da credencial só aparece na resposta de emissão/rotação.
- [ ] Escopo da credencial só aceita coleções da própria org.
- [ ] Não é possível remover/desabilitar o último Admin.
- [ ] Todo comando emite o domain event correspondente com `companyId`+`actorId`.
- [ ] Isolamento: Admin do tenant A não vê/edita usuários ou credenciais do tenant B.

## 11. Dependências e ordem
- Depende de **PRD-0**. É pré-requisito de PRD-2 (papéis/RBAC dos casos de uso), PRD-5 (auth de consumidor) e PRD-6 (UI). Obs.: o **escopo de credencial referencia as coleções do PRD-2** — dependência suave na direção oposta, resolvida por validação de id em runtime (ver §12).

## 12. Riscos & ADRs
- **ADR-010 — Authentication & Credential Strategy** (escrita): sessão server-side opaca e revogável; senha em `argon2id`; API key opaca (`keyPrefix` + `secretHash`, segredo exibido 1x).
- **ADR-011 — Authorization Model** (escrita): autz grosseira por papel na fronteira de aplicação (`AuthorizerPort`), `Role` no shared kernel, invariantes de negócio no domínio, escopo do consumidor forçado no consumo (PRD-5).
- **Decisão adiada:** autenticação do operador → addendum à ADR-010 ou à ADR-009 (Confronto pendente).
- **Decisão adiada:** TTL/expiração opcional de API keys → fase posterior.
- **Risco/decisão:** escopo de credencial referencia coleções (PRD-2) → referência por id validada em runtime, sem FK nem import de tipo cross-context.
