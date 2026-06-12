import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { checkReadableCodeForFile } from './checks/readable-code-check.mjs';
import { emitAdditionalContext, readPayload, safeMain } from './_lib.mjs';

safeMain(async () => {
  const payload = await readPayload();
  if (!payload) return;

  const filePath = payload.tool_input?.file_path ?? payload.tool_response?.filePath;
  if (typeof filePath !== 'string' || !filePath.trim()) return;
  if (!existsSync(filePath)) return;

  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  const result = checkReadableCodeForFile(filePath, content);
  if (!result.applies || result.ok) return;

  const fileName = basename(filePath);
  const findingMessages = result.findings.map((finding) => finding.message);
  const reminder = `skill:readable-code findings in ${fileName}:\n\n${findingMessages.join('\n\n')}\n\nReview before continuing.`;

  emitAdditionalContext('PostToolUse', reminder);
});
