# Hooks

Deterministic enforcement that complements the skills. **Pure Node ESM, zero env var dependencies, zero non-Node runtime requirements.**

## Architecture

```
.claude/hooks/
├── _lib.mjs                    # stdin reader, output emitters, safeMain wrapper
├── checks/                     # pure validation functions (importable from anywhere)
│   ├── tdd-check.mjs
│   ├── hexagonal-check.mjs
│   ├── plainobject-check.mjs
│   └── readable-code-check.mjs
├── adr-detector.mjs            # Claude Code runtime hook (UserPromptSubmit)
├── tdd-checker.mjs             # Claude Code runtime hook (PreToolUse Edit/Write)
├── hexagonal-validator.mjs     # Claude Code runtime hook (PreToolUse Write)
├── plainobject-checker.mjs     # Claude Code runtime hook (PreToolUse Write)
├── safe-refactoring-checker.mjs # Claude Code runtime hook (PreToolUse Edit)
├── pr-template-validator.mjs   # Claude Code runtime hook (PreToolUse Bash|PowerShell)
├── readable-code-checker.mjs   # Claude Code runtime hook (PostToolUse Edit/Write)
├── doc-sync-tracker.mjs        # Claude Code runtime hook (PostToolUse Edit/Write)
└── doc-sync-checker.mjs        # Claude Code runtime hook (Stop)
```

The 4 checks under `checks/` are also reused by [`scripts/precommit.mjs`](../../scripts/precommit.mjs), which runs at git pre-commit time so every agent (Cursor, Codex, Aider, Cline, Continue, Windsurf, Copilot) and unattended commits get the same enforcement.

## Contract

### Claude Code runtime hooks

Each runtime hook:

1. Reads a JSON payload from stdin (provided by Claude Code).
2. Inspects the relevant fields (`prompt`, `tool_input.file_path`, `tool_input.content`, etc.).
3. Emits a JSON response to stdout following the [Claude Code hook contract](https://docs.claude.com/en/docs/claude-code/hooks). Exits 0 on any path — never fail the harness.

The shared helpers in `_lib.mjs` cover stdin reading (`readPayload`), the three response shapes (`emitAdditionalContext`, `emitAskPermission`, `emitStopBlock`), and a top-level `safeMain` that swallows exceptions and always exits 0.

### Pre-commit runner

[`scripts/precommit.mjs`](../../scripts/precommit.mjs) imports the same `checks/*.mjs` functions and runs them against `git diff --cached`. Blocking errors abort the commit; readable-code findings are non-blocking warnings.

## Adding a new hook

1. Add the validation logic as a pure function in `checks/<your-check>.mjs`. It should accept `(filePath, content)` (or whatever the relevant inputs are) and return `{ applies, ok, ...details }`.
2. Add a runtime adapter `<your-check>.mjs` that reads a Claude Code payload, calls the pure check, and emits an appropriate response.
3. Wire it in [`.claude/settings.json`](../settings.json) under the right event/matcher.
4. If it makes sense at commit time, also call it from [`scripts/precommit.mjs`](../../scripts/precommit.mjs).
5. Add a test case in [`scripts/test-hooks.mjs`](../../scripts/test-hooks.mjs).

## Verifying

```bash
npm run hooks:test       # smoke tests against synthetic payloads
npm run precommit        # run the pre-commit checks against currently staged files
npm run hooks:install    # re-install the git pre-commit hook
```
