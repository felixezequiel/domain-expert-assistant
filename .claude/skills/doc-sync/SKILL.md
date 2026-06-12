---
name: skill:doc-sync
description: |
  Post-execution skill that keeps project documentation and persistent memory
  synchronized with code changes. Evaluates after every execution that modifies
  code or makes architectural decisions.

trigger: |
  - After any execution that results in code changes
  - After any architectural decision is made
  - After completing a planned task
  - After doing unplanned work

skip_when: |
  - No code was changed and no decisions were made
  - Cosmetic changes only (formatting, imports, reorder)
  - Intermediate commits within the same PR
  - Explorations/research that didn't result in code

sequence:
  after: [skill:tdd-workflow, skill:adr]

related:
  complementary: [skill:adr, skill:pr-template]
---

# Documentation Sync

## Overview

Outdated documentation is worse than no documentation. Every code change must
reflect in relevant documents. Mandatory final step after every execution.

## Decision Flow

```
Prompt finished. Was there a code change or decision?
|
+-- NO  -> No action
+-- YES ->
    +-- Architectural decision? -> Create or update an ADR in docs/adrs/
    +-- Contradicted existing ADR? -> Add Amendment section
    +-- New convention/pattern? -> Update CLAUDE.md (and AGENTS.md if it duplicates)
    +-- New base class / shared kernel change? -> Update README.md "Core building blocks" + CLAUDE.md
    +-- Knowledge file created/moved? -> Check subfolder, update references
```

## What to Check

| Change Type                    | What to update                                                       |
| ------------------------------ | -------------------------------------------------------------------- |
| New base class in shared/      | `README.md` Core building blocks table + `CLAUDE.md` Key Base Classes |
| New port (interface in domain) | `README.md` if cross-cutting; otherwise just module-local            |
| New convention (file layout)   | `CLAUDE.md` and the relevant skill in `.claude/skills/`              |
| Architectural decision         | Create `docs/adrs/ADR-NNN-*.md`                                      |
| New module pattern             | `docs/adding-a-bounded-context.md` if the walkthrough changes        |
| New env var                    | `.env.example` AND `README.md` Production checklist                  |
| Test pattern change            | `CLAUDE.md` Test Conventions                                         |

## Persistent Memory Rules (when AI tooling has memory)

### Create memory when
- Pattern confirmed across 2+ interactions
- Explicit user decision
- Recurring trap/workaround
- Long work progress tracker (5+ PRs)

### Do NOT create memory when
- Already in CLAUDE.md or README.md
- One-off task
- Speculative/unconfirmed content

### Size rules
- Memory index files: max ~100 useful lines
- Prefer links over copying
- Read first, update instead of duplicate

## Behavior Rules

### MUST
- ALWAYS execute decision flow after each prompt with code changes
- ALWAYS read CLAUDE.md before adding content
- ALWAYS prefer updating existing entry over creating new
- ALWAYS keep README.md, CLAUDE.md, and AGENTS.md consistent

### MUST NOT
- NEVER create documentation structure the project didn't ask for
- NEVER duplicate content between CLAUDE.md and AGENTS.md (cross-reference instead)
- NEVER save speculative information
- NEVER leave documentation outdated after code changes
