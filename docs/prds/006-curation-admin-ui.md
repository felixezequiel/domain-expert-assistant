# PRD-6: Curation & Admin UI

| Campo      | Valor                                   |
| ---------- | --------------------------------------- |
| Status     | Proposto                                |
| Fase       | v1                                      |
| Contexto   | Frontend (consome PRDs 1–5)             |
| Depende de | PRD-1, PRD-2, PRD-3, PRD-5              |

## 1. Objetivo & valor

A interface humana do produto: onde **Admins** configuram a organização, **Curadores** alimentam e organizam o conhecimento, **Revisores** aprovam, **Auditores** inspecionam e **Consumidores humanos** buscam. Sem ela, só máquinas usam o sistema; com ela, o cliente opera o "domain expert" no dia a dia.

> Decisão da descoberta: backend + UI **juntos** no escopo do projeto.

## 2. Escopo

**Inclui (por persona):**
- **Admin:** gerir usuários (convidar, papéis, desabilitar), coleções, tags do tenant, **credenciais de consumidor** (emitir/rotacionar/revogar, ver escopo), e a **política** `requireSeparateReviewer`.
- **Curator:** criar/editar itens (editor de texto livre), **upload de arquivos** (com status do processamento), atribuir coleção/tags/sensibilidade, submeter para revisão, ver versões, rollback.
- **Reviewer:** fila de revisão; aprovar/rejeitar (com motivo); depreciar/arquivar.
- **Auditor:** visão read-only do conhecimento, histórico de versões e **trilha de auditoria** (eventos do tenant).
- **Consumidor humano:** busca (híbrida) + navegação de catálogo + leitura de item, respeitando o que seu papel pode ver.

**Não inclui (fora da v1):**
- SSO, notificações in-app/email, dashboards de analytics, feedback do consumidor.
- Configuração de chaves de modelo (não existe — embeddings são nossos).

## 3. Personas
Admin, Curator, Reviewer, Auditor, Consumidor humano (as 5 da descoberta).

## 4. Telas / fluxos principais
| Área | Telas |
|---|---|
| Auth | Login (email+senha), aceitar convite (definir senha). |
| Admin | Usuários & papéis; Coleções; Tags do tenant; Credenciais de consumidor; Política da org. |
| Curadoria | Lista de itens (filtros: coleção, tag, status, sensibilidade); Editor de item; Upload + status de ingestão; Histórico de versões + diff/rollback. |
| Revisão | Fila "Em revisão"; Detalhe com aprovar/rejeitar; Ações de depreciar/arquivar. |
| Auditoria | Conhecimento read-only; Histórico de versões; Trilha de auditoria (filtros por agregado/ator/intervalo). |
| Consumo humano | Busca + resultados com atribuição/frescor; Navegação por coleção/tag; Leitura de item. |

## 5. Regras de UI ↔ domínio
- A UI **só** consome as APIs dos PRD-1/2/3/5; não duplica regra de negócio.
- Visibilidade de ações segue o **papel** (RBAC do PRD-1): botões/rotas escondidos/negados conforme permissão.
- Estados de ciclo de vida e transições refletem a máquina de estados do PRD-2 (UI não inventa transições).
- Sensibilidade e coleção são campos de primeira classe no editor.
- Busca humana usa o mesmo `KnowledgeQueryFacade` (PRD-5) — paridade com consumidores de máquina, mas com sessão humana (não API key).

## 6. Critérios de aceite
- [ ] Cada persona só acessa telas/ações do seu papel (testes de autorização na UI + API).
- [ ] Fluxo completo: upload → item Draft → editar → submeter → aprovar (revisor distinto se a política exigir) → publicado → aparece na busca.
- [ ] Rollback restaura versão anterior e a UI mostra o diff entre versões.
- [ ] Auditor vê a trilha de eventos do tenant (quem fez o quê, quando), sem editar nada.
- [ ] Consumidor humano busca e só vê conteúdo permitido ao seu papel; resultados mostram atribuição + frescor.
- [ ] Nenhuma tela expõe segredo de credencial após a emissão.

## 7. Dependências e ordem
- Depende das APIs dos PRD-1/2/3/5 (e indiretamente PRD-4 via busca). Última a "fechar" a v1, mas pode evoluir em paralelo conforme cada API estabiliza.

## 8. Riscos & ADRs
- **ADR:** "Frontend Stack & Repo Boundary" — framework, repo separado vs monorepo, autenticação humana (sessão/JWT), build/deploy. (Backend é Node/TS; UI provavelmente repo próprio consumindo a API.)
- **Risco:** escopo de UI é grande — priorizar por persona (Admin + Curator + Reviewer primeiro; Auditor e Consumo humano em seguida) dentro da v1.
- **Decisão em aberto:** editor de conteúdo (markdown puro vs rich text) — alinhar com "corpo livre" do PRD-2.
