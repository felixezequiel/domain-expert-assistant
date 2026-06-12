import { existsSync, readFileSync } from 'node:fs';
import { emitAskPermission, readPayload, safeMain } from './_lib.mjs';

const GH_PR_CREATE_PATTERN = /\bgh\s+pr\s+create\b/;
const SUMMARY_HEADING_PATTERN = /^##\s+(summary|resumo|descri[cç][aã]o)/im;
const TEST_PLAN_HEADING_PATTERN = /^##\s+(test plan|plano de teste|como testar|testing|tests)/im;

const BODY_FILE_FLAG_PATTERN = /--body-file\s+['"]?([^'"\s]+)/;
const BODY_SINGLE_QUOTED_FLAG_PATTERN = /--body\s+'([^']*)'/;
const BODY_DOUBLE_QUOTED_FLAG_PATTERN = /--body\s+"((?:[^"\\]|\\.)*)"/;
const HEREDOC_BODY_PATTERN = /<<\s*'?(\w+)'?\s*\r?\n([\s\S]*?)\r?\n\1\b/;

function extractBody(command) {
  const heredocMatch = command.match(HEREDOC_BODY_PATTERN);
  if (heredocMatch) return heredocMatch[2];

  const bodyFileMatch = command.match(BODY_FILE_FLAG_PATTERN);
  if (bodyFileMatch) {
    const filePath = bodyFileMatch[1];
    if (existsSync(filePath)) {
      try {
        return readFileSync(filePath, 'utf8');
      } catch {
        return null;
      }
    }
    return null;
  }

  const singleQuoted = command.match(BODY_SINGLE_QUOTED_FLAG_PATTERN);
  if (singleQuoted) return singleQuoted[1];

  const doubleQuoted = command.match(BODY_DOUBLE_QUOTED_FLAG_PATTERN);
  if (doubleQuoted) return doubleQuoted[1];

  return null;
}

safeMain(async () => {
  const payload = await readPayload();
  if (!payload?.tool_input) return;

  const command = payload.tool_input.command;
  if (typeof command !== 'string' || !command.trim()) return;
  if (!GH_PR_CREATE_PATTERN.test(command)) return;

  const body = extractBody(command);

  if (!body || !body.trim()) {
    const reason =
      'skill:pr-template - gh pr create called without detectable --body content. Use --body with a heredoc or --body-file containing the project template sections (Summary, Test plan).';
    emitAskPermission('PreToolUse', reason);
    return;
  }

  const missing = [];
  if (!SUMMARY_HEADING_PATTERN.test(body)) {
    missing.push('Summary section (## Summary / ## Resumo)');
  }
  if (!TEST_PLAN_HEADING_PATTERN.test(body)) {
    missing.push('Test plan section (## Test plan / ## Plano de teste)');
  }

  if (missing.length === 0) return;

  const reason = [
    'skill:pr-template - PR body is missing required sections:',
    `  - ${missing.join('\n  - ')}`,
    'Fill the project template before creating the PR.',
  ].join('\n');

  emitAskPermission('PreToolUse', reason);
});
