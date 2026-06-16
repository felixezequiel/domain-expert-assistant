# ADR-014: Taxonomy — Tags de Sistema vs Tenant

## Status

Proposto

## Data

2026-06-13

## Contexto

O `KnowledgeItem` é classificado por tags (facetas). Há dois tipos: **tags de sistema** — vocabulário fixo definido pelo produto (`glossário, regra, processo, faq, documento`), imutável e idêntico para todos os tenants — e **tags de tenant** — facetas que cada org cria e remove. A PRD-2 modelou ambas como um `Tag` com discriminador de escopo e propôs que as de sistema tenham `company_id = null` e fiquem "fora do filtro". Isso colide com a ADR-009, que determinou que linha com `company_id = null` em tabela tenant-scoped só aparece em escopo privilegiado. Precisamos resolver o armazenamento/visibilidade das tags de sistema, a modelagem do agregado `Tag`, o que acontece ao remover uma tag de tenant em uso, e o seed inicial.

A chave para destravar: o que a ADR-009 protege é *nenhum tenant ver o dado privado de outro*. Tag de sistema **não é dado de tenant** — é vocabulário de produto, não-confidencial e compartilhado de propósito (como `Role` no shared kernel ou os três níveis de `Sensitivity`). Logo, vê-la em todos os tenants não é vazamento.

## Alternativas Consideradas

### 1. Tabela unificada com filtro explícito `próprio ∪ sistema` (escolhida)

Uma tabela `tags`; o filtro é `company_id = :tenant OR scope = 'system'`. Tags de sistema são linhas semeadas pelo produto, imutáveis, `company_id = null`, que nenhum tenant escreve.

- **Prós:** `TagRef` é só um id; `ListTags` é trivial; o vocabulário de produto evolui num lugar só; isolamento das tags de tenant intacto.
- **Contras:** `null` em tabela tenant passa a ter dois sentidos (operacional-privilegiado e referência-compartilhada); exige escrever o filtro dessa tabela com cuidado.

### 2. Tags de sistema como dado de referência fora da tabela tenant

Tags de sistema viram constantes/seed global numa fonte separada; tags de tenant ficam na tabela filtrada; `ListTags` faz union na leitura.

- **Prós:** mantém a regra da ADR-009 literalmente intacta (nenhum `null` lido em escopo normal).
- **Contras:** `TagRef` precisa distinguir a origem; duas fontes para ler e manter.

### 3. Duplicar as tags de sistema em cada tenant no provisionamento

Cada org recebe sua própria cópia das tags de sistema; nada fica com `company_id = null`.

- **Prós:** isolamento puríssimo; zero exceção de filtro.
- **Contras:** duplicação; evoluir o vocabulário do produto passa a tocar todos os tenants; risco de drift entre cópias.

## Decisão

Escolhida a **alternativa 1**. Tabela `tags` unificada com filtro `company_id = :tenant OR scope = 'system'`. Tags de sistema são imutáveis, semeadas pelo produto, com `company_id = null` e `scope = 'system'`; nenhum tenant as cria, edita ou remove. Isso não enfraquece a ADR-009 porque vocabulário compartilhado não-confidencial não é dado privado de tenant — a visibilidade cross-tenant é intencional. A ADR-009 é **emendada** para registrar que `null` em tabela tenant tem dois sentidos explícitos: dado operacional de escopo privilegiado **ou** dado de referência compartilhado, imutável e read-only.

Decisões companheiras:

- **`Tag` é um agregado pequeno e próprio.** A unicidade de `slug` por org é garantida por **índice único `(company_id, slug)`**, não por um agregado `Taxonomy` que carregue todas as tags do tenant (evita o mesmo smell de coleção ilimitada da ADR-012).
- **Remover tag de tenant em uso é bloqueado** (consistente com a exclusão de coleção da ADR-013): falha com erro explícito; destag em lote fica para fase posterior.
- **Seed v1:** `glossário, regra, processo, faq, documento`.

## Consequências

**Positivas:**

- `TagRef` permanece um único id; `ListTags` retorna sistema + tenant numa consulta só.
- O vocabulário de sistema evolui em um lugar (um seed), sem tocar tenants nem arriscar drift.
- Isolamento das tags de tenant continua sob as garantias da ADR-009.

**Negativas:**

- `null` em tabela tenant ganha um segundo sentido — custo cognitivo, mitigado por estar documentado na ADR-009 e restrito a dado de referência imutável.
- O filtro da tabela `tags` é uma exceção que precisa ser escrita e testada com cuidado (um filtro errado exporia tags, ainda que não-confidenciais).
- Bloquear remoção de tag em uso transfere trabalho manual ao curador até existir destag em lote.

**Neutras:**

- Surge um seed de tags de sistema (migração).
- O agregado `Tag` é pequeno; nenhuma mudança no pipeline de aplicação.

## Regras Derivadas

- Tags de sistema são imutáveis, `company_id = null`, `scope = 'system'`, semeadas pelo produto; nenhum caminho de tenant as escreve.
- O filtro da tabela `tags` é `company_id = :tenant OR scope = 'system'`; é a única exceção de referência-compartilhada, documentada na ADR-009.
- `slug` é único por org via índice único `(company_id, slug)`; `Tag` é agregado próprio, não uma coleção dentro de um `Taxonomy`.
- Tag de tenant em uso não pode ser removida na v1.
