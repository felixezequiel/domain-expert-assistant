# ADR-010: Authentication & Credential Strategy

## Status

Proposto

## Data

2026-06-12

## Contexto

A PRD-1 precisa definir como dois tipos de principal provam identidade: o **humano** (curadoria, via UI) e a **integração consumidora de IA** (via API key). A revogação imediata é requisito de produto, não conforto: o caso de uso `DisableUser` e o critério "após revogar, não autentica mais" exigem que desligar um acesso tenha efeito instantâneo. A ADR-008 já determinou que a API key é **opaca, revogável e resolvida no servidor** (a company nunca vem do cliente), e que toda chamada abre um Actor Context a partir do principal autenticado. Falta fechar, de forma consistente com isso, o **mecanismo de sessão humana**, o **hashing de senha** e o **armazenamento/lookup da credencial**. Estamos num monólito Node + SQLite.

## Alternativas Consideradas

A decisão central — onde mora o trade-off — é o mecanismo de sessão humana.

### 1. JWT stateless de vida longa

Token autocontido assinado; o servidor não guarda estado de sessão.

- **Prós:** sem session store; padrão de mercado; escala horizontalmente sem estado compartilhado.
- **Contras:** **não é revogável** antes de expirar — um usuário desabilitado continua agindo até o token vencer, quebrando `DisableUser`; é o oposto do modelo revogável que adotamos para API key.

### 2. JWT curto + refresh token revogável

Access token de TTL curto + refresh token revogável guardado no servidor.

- **Prós:** maior parte das requisições é stateless; revogação possível via refresh.
- **Contras:** o access token ainda vale até o TTL curto após o disable (janela residual); mais peças (rotação de refresh, denylist); complexidade que o monólito não exige.

### 3. Sessão server-side opaca (escolhida)

Session id opaco → lookup no servidor a cada request; o lookup resolve o principal e seu estado atual.

- **Prós:** revogação **imediata** (disable/logout mata a sessão na hora); consistente com o modelo de API key; trivial num monólito + SQLite; o lookup por request já é necessário para resolver o tenant; entrega papéis atualizados a cada chamada (alimenta a ADR-011).
- **Contras:** servidor é stateful (escala horizontal futura exige store de sessão compartilhado); um lookup de sessão por request; tabela de sessões precisa de expiração/limpeza.

## Decisão

Escolhida a **alternativa 3**: **sessão server-side opaca e revogável** para o humano. Decisões companheiras, derivadas do mesmo princípio (revogável + segredo nunca em claro + resolve no servidor):

- **Hashing de senha:** `argon2id` (memory-hard, default atual do OWASP). `bcrypt` é fallback aceitável se houver restrição de runtime.
- **API key do consumidor:** segredo **opaco**, exibido **uma única vez** na emissão/rotação. Persistimos apenas `keyPrefix` (índice para lookup rápido) + `secretHash` (verificação). Revogar muda o status e a credencial para de autenticar de imediato. Confirma e estende a ADR-008.
- **Resolução do principal:** tanto a sessão humana quanto a API key resolvem, no servidor, para um principal amarrado a **exatamente uma** company; é esse passo que abre o Actor Context da ADR-008 (`{ companyId, actorId, actorType }`).
- **Autenticação do operador:** um **segredo único de operador** em config segura, usado por um CLI/endpoint **interno** (fora da superfície pública), que abre o escopo privilegiado da ADR-009; eventos saem com `actorType = operator`. Para a v1 aceitamos `actorId` grosseiro (um operador — nós); accountability por-humano vira evolução se surgirem múltiplos operadores.

## Consequências

**Positivas:**

- Revogação imediata e uniforme para humano e máquina — alinhada à razão de existir do produto (governança/auditoria).
- O lookup de sessão entrega papéis/escopo frescos a cada request, sem o risco de "papel mudou mas o token antigo continua valendo" — base direta para a ADR-011.
- Modelo único de credencial (opaco + hash + lookup) reduz superfície de erro.

**Negativas:**

- O servidor passa a ser stateful: escala horizontal no futuro exige um store de sessão compartilhado (hoje, SQLite basta).
- Um lookup de sessão por request (custo baixo, mas real).
- A tabela de sessões cresce e precisa de expiração/limpeza (dívida operacional pequena, registrada).

**Neutras:**

- Surge uma tabela de sessões tenant-scoped, sujeita às garantias da ADR-009.
- A resolução do principal é o ponto de integração com o Actor Context da ADR-008.

**Decisões adiadas:**

- TTL/expiração opcional de API keys → fase posterior.
- Accountability por-humano do operador (múltiplos operadores com identidade própria) → evolução, se necessário.

## Regras Derivadas

- Segredos (senha, API key) nunca são persistidos em claro — apenas hash; a API key guarda também `keyPrefix` só para lookup.
- Login com senha errada e com email inexistente retornam erro **indistinguível** (não vaza existência de conta).
- `DisableUser` e logout invalidam as sessões do usuário na hora; credencial revogada não autentica mais.
- Verificação de segredo é feita por comparação de hash; a entrada do cliente nunca decide a company.
- A resolução de sessão/credencial é o único lugar que abre o Actor Context; nenhum handler executa sem ele (ADR-008).
