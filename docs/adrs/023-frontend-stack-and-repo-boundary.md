# ADR-023: Frontend Stack & Repo Boundary

## Status

Proposto

## Data

2026-06-16

## Contexto

A PRD-6 entrega a UI humana das 5 personas (Admin, Curator, Reviewer, Auditor, Consumidor humano). O backend é um monólito TS DDD/hexagonal que expõe REST. Um ponto precisava de clareza: a arquitetura hexagonal restringe o **backend** (ports/adapters em torno do domínio) — a UI **não vive dentro do hexágono**, é apenas mais um **cliente da porta primária HTTP**. Logo "temos DDD" não dita a stack da UI. Decidiu-se **monorepo**. Falta fixar como a UI é construída/servida, o framework, a auth no browser, qual API ela consome e o editor de conteúdo. A UI tem interatividade real: editor markdown com preview, diff de versões, status de ingestão ao vivo, busca híbrida e telas que mudam por papel.

## Alternativas Consideradas

### 1. HTML/CSS nativo (JS mínimo)

Páginas simples, pouco JS.

- **Prós:** começo mais simples, sem build de frontend.
- **Contras:** falsa economia aqui — editor+preview, diff, status ao vivo e busca acabam reinventando estado/componentes em vanilla JS ou recarregando página inteira; teto baixo.

### 2. HTML server-rendered + htmx/Alpine

Servidor renderiza HTML; interatividade leve no cliente.

- **Prós:** leve, fica dentro do Node, sem build de SPA.
- **Contras:** editor markdown, diff e status ao vivo ainda exigem JS custom; teto moderado para o nível de interação desta UI.

### 3. SPA (React + Vite) em `/web`, servida estática pelo monólito (escolhida)

Bundle estático servido pelo próprio `HttpServer`.

- **Prós:** atende a interatividade real; monorepo + **mesma origem** (cookie de sessão trivial); um processo, um deploy; não toca o hexágono.
- **Contras:** adiciona um build/passo de CI de frontend + bundle JS + estado no cliente; segunda toolchain no repo.

## Decisão

Escolhida a **alternativa 3**. SPA em **`/web`** (irmão de `/src`, **fora** do hexágono — cliente da porta REST), framework **React + Vite**, compilada para **assets estáticos servidos pelo próprio `HttpServer`** (um processo, um deploy, mesma origem). O framework é swappável: o encaixe arquitetural é idêntico para Vue/Svelte/Angular.

- **A UI não duplica regra de domínio** — consome apenas o REST dos PRD-1/2/3/5. A visibilidade de ação por papel é **cosmética (UX)**; a autorização autoritativa é server-side (ADR-011) — botão escondido não é segurança.
- **Auth no browser = cookie `httpOnly` + `SameSite`** carregando a sessão opaca da ADR-010; **nunca** token em `localStorage` (legível por XSS). A mesma origem (monólito serve SPA + API) torna isso limpo, sem CORS.
- **REST apenas.** O `GraphqlServer` do template fica **sem uso na v1** — acendê-lo criaria uma segunda superfície de autz/escopo para proteger, por pouco ganho.
- **Editor = markdown com preview** (o corpo é markdown; alinha com o chunking structure-aware da ADR-017). WYSIWYG que serializa para markdown é aceitável; rich-text opaco não.
- **CI:** monorepo ganha um passo de build/test do `/web`; nenhum repo separado é necessário.

## Consequências

**Positivas:**

- Atende a interatividade real (editor, diff, status ao vivo, busca) que HTML nativo penaria.
- Cookie de sessão limpo pela mesma origem; reforça a ADR-010.
- Monorepo simples (possível compartilhar tipos/DTOs TS); o hexágono permanece intocado; um deploy só.

**Negativas:**

- Adiciona build de frontend + passo de CI + bundle JS + gestão de estado no cliente (segunda toolchain).
- Tamanho do bundle React e tempo de build entram no ciclo.

**Neutras:**

- GraphQL fica adiado (template tem, não usamos na v1).
- Caminho htmx/Alpine descartado; framework permanece trocável (arquitetura é agnóstica a ele).

## Regras Derivadas

- A UI vive em `/web`, fora do hexágono; consome só REST; nunca duplica regra de domínio.
- Sessão no browser = cookie `httpOnly` + `SameSite`; jamais token em `localStorage`.
- Visibilidade por papel na UI é UX; a autorização real é server-side (ADR-011).
- O corpo de conhecimento é editado e armazenado como markdown.
- **Emenda (2026-06-17): a comparação de versões usa o DiffEditor do Monaco (VS Code), tema Monokai.** `@monaco-editor/react` + `monaco-editor` são bundlados **localmente** (não o CDN padrão do loader — mantém a SPA self-contained/offline, coerente com este ADR) e **lazy-loaded** (chunk próprio), então só a tela de histórico de versões carrega o peso do Monaco. Monaco não roda em jsdom: componentes que o usam são testados mockando `@monaco-editor/react`, com `monaco-editor` + `?worker` apontados para stubs via `test.alias`; o editor real é verificado no build + navegador.
- A SPA é compilada estática e servida pelo monólito na mesma origem; o CI inclui um passo para `/web`.

## Emenda — 2026-06-16: sistema de UI, endpoints de leitura para a SPA, sessão e capabilities

A v1 da SPA validou a decisão acima, mas a implementação fixou quatro pontos que o ADR original deixou em aberto (ou que um comentário no código havia interpretado de forma restritiva demais). Registramos aqui o **porquê**.

1. **Sistema de UI = shadcn/ui + Tailwind v3 + design tokens.** O framework segue trocável (React+Vite); o que se fixa é a camada de componentes/estilo: primitivas shadcn copiadas em `web/src/components/ui/`, `cn()` em `web/src/lib/utils.ts`, ícones `lucide-react`, toasts `sonner`, alias `@/ → web/src`. Tema **dark + acento azul** expresso como **design tokens** (variáveis CSS HSL em `web/src/styles.css`, mapeadas no `tailwind.config.js`); retunar a marca = editar `--primary`/`--ring`. Tipografia com propósito (display serif para títulos/marca, grotesk no corpo, mono em IDs/chaves). **Trade-off:** adiciona Radix/Tailwind/CVA/lucide/sonner ao pacote `web/`, em troca de acessibilidade, consistência e velocidade de construção — sem tocar o hexágono.

2. **Endpoints de leitura dedicados à SPA são permitidos.** O ADR diz "a UI consome só REST" — **não proíbe** criar endpoints; um comentário antigo em `capabilities.ts` ("backend congelado") era uma leitura equivocada. Foram adicionados endpoints **read-only**: `GET /auth/me`, `GET /organizations/:orgId/users`, `GET /organizations/:orgId/policy` (gate por papel onde aplicável). A regra real continua: a UI não duplica regra de domínio; consome a porta REST.

3. **Re-hidratação de sessão no boot.** Supera o comportamento original ("sessão só em memória; refresh volta ao login"): ao iniciar, a SPA chama `GET /auth/me` para **restaurar a sessão a partir do cookie `httpOnly` ainda válido** (TTL de 7 dias, ADR-010). Um refresh não desloga mais o usuário. O cookie segue sendo a fonte de verdade; a memória do React é apenas cache de UI.

4. **Capabilities derivam dos papéis de `/auth/me`, não de probes.** Antes, a UI sondava endpoints role-gated e derivava capacidades do 200/403 (gerava 403 ruidosos no console). Agora os papéis vêm exatos no `/auth/me` e as capacidades (`canAdminister/canAudit/canCurate/canReview`) derivam deles, guardando a navegação e — via `RequireCapability` — as rotas de admin/auditoria. **Continua cosmético**: a autorização autoritativa permanece server-side (ADR-011); `RequireCapability` apenas evita renderizar telas que o papel não usa (a ação ainda seria barrada com 403).

**IA derivada:** as cinco telas de administração foram agrupadas em uma área **`/settings`** com sub-abas (Members/Collections/Tags/API credentials/Policy) — uma só entrada semântica na navegação em vez de cinco links soltos —, e telas de detalhe ganharam breadcrumbs.
