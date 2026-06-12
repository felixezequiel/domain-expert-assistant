import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { emitStopBlock, hooksDir, readPayload, safeMain, splitLines } from './_lib.mjs';

const STATE_DIR = resolve(hooksDir(), '..', '.state');

const DOCUMENTATION_PATH_PATTERNS = [
  /\.md$/i,
  /CLAUDE\.md$/i,
  /AGENTS\.md$/i,
  /README\.md$/i,
  /\/docs\//i,
  /\\docs\\/i,
  /\/adrs\//i,
  /\\adrs\\/i,
  /\/knowledge\//i,
  /\\knowledge\\/i,
];

function isDocumentationFile(filePath) {
  return DOCUMENTATION_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
}

safeMain(async () => {
  const payload = await readPayload();
  if (!payload) return;

  const sessionId = payload.session_id;
  if (typeof sessionId !== 'string' || !sessionId.trim()) return;

  const stateFile = join(STATE_DIR, `doc-sync-${sessionId}.txt`);
  if (!existsSync(stateFile)) return;

  let modifiedFiles = [];
  try {
    const raw = readFileSync(stateFile, 'utf8');
    modifiedFiles = splitLines(raw).filter((line) => line.trim().length > 0);
  } catch {
    return;
  } finally {
    try {
      rmSync(stateFile, { force: true });
    } catch {
      // Best-effort cleanup.
    }
  }

  if (modifiedFiles.length === 0) return;

  let codeChanged = false;
  let docsUpdated = false;
  for (const file of modifiedFiles) {
    if (isDocumentationFile(file)) {
      docsUpdated = true;
    } else {
      codeChanged = true;
    }
  }

  if (!codeChanged) return;
  if (docsUpdated) return;

  const reminder = [
    'skill:doc-sync - code was modified this session but no documentation/ADR was updated.',
    'Before stopping, evaluate:',
    '  1. Did this introduce a new pattern or convention? Update CLAUDE.md (and AGENTS.md if relevant).',
    '  2. Was an architectural decision made? Create or update an ADR in docs/adrs/.',
    '  3. Did a public API change? Update README.md API surface.',
    '  4. New env var? Update .env.example AND README.md Production checklist.',
    'If genuinely no doc update is needed, state that explicitly and stop.',
  ].join('\n');

  emitStopBlock(reminder);
});
