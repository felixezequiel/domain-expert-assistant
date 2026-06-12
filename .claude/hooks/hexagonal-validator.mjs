import { checkHexagonalForFile } from './checks/hexagonal-check.mjs';
import { emitAskPermission, readPayload, safeMain } from './_lib.mjs';

safeMain(async () => {
  const payload = await readPayload();
  if (!payload?.tool_input) return;

  const filePath = payload.tool_input.file_path;
  const content = payload.tool_input.content;
  if (typeof filePath !== 'string' || !filePath.trim()) return;
  if (typeof content !== 'string' || !content.trim()) return;

  const result = checkHexagonalForFile(filePath, content);
  if (!result.applies || result.ok) return;

  const reason = [
    `skill:hexagonal-architecture - ${result.layer} layer must not depend on outer layers.`,
    'Violations:',
    `  - ${result.violations.join('\n  - ')}`,
    'Move the dependency to a port (interface in domain/application) and inject the infra adapter from the composition root.',
  ].join('\n');

  emitAskPermission('PreToolUse', reason);
});
