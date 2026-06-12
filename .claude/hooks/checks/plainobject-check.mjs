import { extname } from 'node:path';

const ORM_ENTITIES_PATH_PATTERN = /\/mikro-orm\/entities\//i;
const EXPORT_CLASS_PATTERN = /^\s*export\s+class\s+(\w+)/gm;
const EXTENDS_PLAIN_OBJECT_PATTERN = /extends\s+PlainObject\b/;
const PLAIN_OBJECT_IMPORT_PATTERNS = [
  /from\s+["']@mikro-orm\/core["'][^;]*PlainObject/,
  /PlainObject[^;]*from\s+["']@mikro-orm\/core["']/,
];

function normalizePath(value) {
  return value.replace(/\\/g, '/').toLowerCase();
}

export function isOrmEntityFile(filePath) {
  if (!filePath) return false;
  if (extname(filePath).toLowerCase() !== '.ts') return false;
  return ORM_ENTITIES_PATH_PATTERN.test(normalizePath(filePath));
}

export function checkPlainObjectForFile(filePath, content) {
  if (!isOrmEntityFile(filePath)) {
    return { applies: false, ok: true };
  }

  const classMatches = Array.from(content.matchAll(EXPORT_CLASS_PATTERN));
  if (classMatches.length === 0) {
    return { applies: false, ok: true };
  }

  const hasPlainObjectExtension = EXTENDS_PLAIN_OBJECT_PATTERN.test(content);
  const importsPlainObject = PLAIN_OBJECT_IMPORT_PATTERNS.some((pattern) => pattern.test(content));

  if (hasPlainObjectExtension && importsPlainObject) {
    return { applies: true, ok: true };
  }

  return {
    applies: true,
    ok: false,
    classes: classMatches.map((match) => match[1]),
  };
}
