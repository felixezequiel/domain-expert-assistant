import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { emitAdditionalContext, readPayload, safeMain, splitLines } from './_lib.mjs';

const REFACTOR_BRANCH_PATTERN = /^(refactor|refactoring)\//;
const MIN_REPLACED_LINES_TO_FLAG = 5;

function getCurrentBranch(workingDirectory) {
  try {
    const stdout = execFileSync('git', ['-C', workingDirectory, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return stdout.trim();
  } catch {
    return '';
  }
}

safeMain(async () => {
  const payload = await readPayload();
  if (!payload?.tool_input) return;

  const filePath = payload.tool_input.file_path;
  if (typeof filePath !== 'string' || !filePath.trim()) return;

  const directory = dirname(filePath);
  if (!existsSync(directory)) return;

  const branch = getCurrentBranch(directory);
  if (!branch) return;
  if (!REFACTOR_BRANCH_PATTERN.test(branch)) return;

  const oldString = payload.tool_input.old_string;
  if (typeof oldString !== 'string' || !oldString.trim()) return;

  const replacedLineCount = splitLines(oldString).length;
  if (replacedLineCount < MIN_REPLACED_LINES_TO_FLAG) return;

  const fileName = basename(filePath);
  const reminder = [
    `skill:safe-refactoring - branch '${branch}' suggests refactoring, but you are editing ${fileName} in place (${replacedLineCount} lines being replaced).`,
    'Safe refactoring requires:',
    `  1. Create a NEW implementation side by side (e.g., ${fileName}V2)`,
    '  2. Wire it behind a feature toggle in src/main.ts',
    '  3. Validate in production',
    '  4. Only then remove the old code',
    'If this edit is a small fix unrelated to the refactor, ignore. Otherwise, switch to parallel implementation.',
  ].join('\n');

  emitAdditionalContext('PreToolUse', reminder);
});
