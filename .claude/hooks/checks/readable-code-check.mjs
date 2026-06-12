import { basename, extname } from 'node:path';

const CHECKED_EXTENSIONS = new Set(['.ts', '.tsx']);
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx)$/i;

const SKIP_PATTERN_LIST = [
  /node_modules\//,
  /\/build\//,
  /\/dist\//,
  /\/coverage\//,
  /\/(integrationTests|performanceTests)\//i,
  /\/migrations\//,
  /\/scripts\//,
];

const STRING_LITERAL_PATTERNS = [/"[^"]*\b\d+\b[^"]*"/, /'[^']*\b\d+\b[^']*'/, /`[^`]*\b\d+\b[^`]*`/];
const MAGIC_NUMBER_PATTERN = /\b(?<!\.)(?<![0-9])([2-9]\d|\d{3,})\b(?![0-9])/;
const COMMON_HTTP_STATUS_CODES = new Set(['200', '201', '204', '301', '302', '400', '401', '403', '404', '409', '422', '500', '502', '503']);
const YEAR_LITERAL_PATTERN = /^(19|20)\d{2}$/;

const NESTED_TERNARY_PATTERN = /\?[^?:]*:[^?:]*\?/g;
const LONG_FUNCTIONAL_CHAIN_PATTERN = /\.(map|filter|reduce|flatMap)\s*\([^)]*\)\s*\.(map|filter|reduce|flatMap)\s*\([^)]*\)\s*\.(map|filter|reduce|flatMap)/g;

const MAX_REPORTED_MAGIC_LINES = 3;

function normalizePath(value) {
  return value.replace(/\\/g, '/');
}

export function isCandidateForReadableCheck(filePath) {
  if (!filePath) return false;
  const fileName = basename(filePath);
  const extension = extname(filePath).toLowerCase();
  const normalizedPath = normalizePath(filePath);

  if (!CHECKED_EXTENSIONS.has(extension)) return false;
  if (TEST_FILE_PATTERN.test(fileName)) return false;
  if (SKIP_PATTERN_LIST.some((pattern) => pattern.test(normalizedPath))) return false;
  return true;
}

function detectMagicNumberLines(content) {
  const lines = content.split(/\r?\n/);
  const findings = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (findings.length >= MAX_REPORTED_MAGIC_LINES) break;

    const line = lines[index];
    const stripped = line.replace(/\/\/.*$/, '');

    if (STRING_LITERAL_PATTERNS.some((pattern) => pattern.test(stripped))) continue;

    const match = stripped.match(MAGIC_NUMBER_PATTERN);
    if (!match) continue;

    const matchedNumber = match[1];
    if (YEAR_LITERAL_PATTERN.test(matchedNumber)) continue;
    if (COMMON_HTTP_STATUS_CODES.has(matchedNumber)) continue;

    findings.push(`L${index + 1}: ${line.trim()}`);
  }

  return findings;
}

export function checkReadableCodeForFile(filePath, content) {
  if (!isCandidateForReadableCheck(filePath)) {
    return { applies: false, ok: true, findings: [] };
  }
  if (!content || !content.trim()) {
    return { applies: false, ok: true, findings: [] };
  }

  const findings = [];

  const magicNumberLines = detectMagicNumberLines(content);
  if (magicNumberLines.length > 0) {
    findings.push({
      kind: 'magic-numbers',
      message: `Magic numbers detected (consider named constants):\n  - ${magicNumberLines.join('\n  - ')}`,
    });
  }

  const nestedTernaryMatches = content.match(NESTED_TERNARY_PATTERN);
  if (nestedTernaryMatches && nestedTernaryMatches.length > 0) {
    findings.push({
      kind: 'nested-ternary',
      message: `Nested ternary detected (${nestedTernaryMatches.length} occurrence(s)). Prefer explicit if/else.`,
    });
  }

  const longChainMatches = content.match(LONG_FUNCTIONAL_CHAIN_PATTERN);
  if (longChainMatches && longChainMatches.length > 0) {
    findings.push({
      kind: 'long-functional-chain',
      message: `Long functional chain detected (${longChainMatches.length} instance(s) of 3+ chained .map/.filter/.reduce/.flatMap). Prefer explicit for-of when business logic is involved.`,
    });
  }

  return { applies: true, ok: findings.length === 0, findings };
}
