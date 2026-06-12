import { checkTddForFile } from './checks/tdd-check.mjs';
import { emitAdditionalContext, readPayload, safeMain } from './_lib.mjs';

safeMain(async () => {
  const payload = await readPayload();
  if (!payload?.tool_input) return;

  const filePath = payload.tool_input.file_path;
  if (typeof filePath !== 'string' || !filePath.trim()) return;

  const result = checkTddForFile(filePath);
  if (!result.applies || result.ok) return;

  const reminder = [
    `TDD check: no co-located test file found for "${result.fileName}".`,
    'skill:tdd-workflow requires tests BEFORE production code (Red-Green-Refactor).',
    `Expected: ${result.expectedTestFile} next to ${result.fileName}.`,
    '',
    'If this is a new feature or bug fix, write the failing test first, confirm it fails, then implement.',
    'If this is a Mapper, Schema, or boilerplate covered by integration tests, proceed.',
  ].join('\n');

  emitAdditionalContext('PreToolUse', reminder);
});
