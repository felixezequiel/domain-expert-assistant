import { checkPlainObjectForFile } from './checks/plainobject-check.mjs';
import { emitAskPermission, readPayload, safeMain } from './_lib.mjs';

safeMain(async () => {
  const payload = await readPayload();
  if (!payload?.tool_input) return;

  const filePath = payload.tool_input.file_path;
  const content = payload.tool_input.content;
  if (typeof filePath !== 'string' || !filePath.trim()) return;
  if (typeof content !== 'string' || !content.trim()) return;

  const result = checkPlainObjectForFile(filePath, content);
  if (!result.applies || result.ok) return;

  const reason = [
    'ORM entity file detected without `extends PlainObject`.',
    '',
    `Class(es): ${result.classes.join(', ')}`,
    `File: ${filePath}`,
    '',
    "This is the template's #1 footgun. Without `extends PlainObject` from `@mikro-orm/core`, MikroORM uses property-accessor proxies on managed entities. Calling em.upsert(SomeClass, plainInstance) re-uses identity-mapped proxies and returns proxy values from getters, breaking mappers and triggering subtle hydration bugs.",
    '',
    'Required:',
    "  import { PlainObject } from '@mikro-orm/core';",
    '  export class FooEntity extends PlainObject { ... }',
    '',
    'Apply to ROOT entity AND every child entity registered in an EntitySchema.',
  ].join('\n');

  emitAskPermission('PreToolUse', reason);
});
