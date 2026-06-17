import { existsSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

const PRODUCTION_EXTENSIONS = new Set(['.ts', '.tsx']);
const BOILERPLATE_FILENAMES = new Set(['index.ts', 'types.ts', 'errors.ts']);

const SKIP_PATTERN_LIST = [
  /node_modules\//,
  /\/build\//,
  /\/dist\//,
  /\/coverage\//,
  /\/migrations\//,
  /\/scripts\//,
  /\.config\.(ts|js)$/,
  /mikro-orm\.config\./,
  /main\.ts$/,
  // Vendored shadcn/ui primitives (copied library components, not first-party logic — like
  // index.ts/ORM artifacts above, they are boilerplate exercised through the screens' tests).
  /\/components\/ui\//,
];

const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx)$/i;
const INTEGRATION_OR_PERFORMANCE_PATTERN = /\/(integrationTests|performanceTests)\//i;
const ORM_ARTIFACTS_PATTERN = /\/mikro-orm\/(entities|schemas)\//i;

function normalizePath(value) {
  return value.replace(/\\/g, '/');
}

export function isCandidateForTddCheck(filePath) {
  if (!filePath) return false;
  const fileName = basename(filePath);
  const extension = extname(filePath).toLowerCase();
  const normalizedPath = normalizePath(filePath);

  if (!PRODUCTION_EXTENSIONS.has(extension)) return false;
  if (/\.d\.ts$/.test(fileName)) return false;
  if (TEST_FILE_PATTERN.test(fileName)) return false;
  if (INTEGRATION_OR_PERFORMANCE_PATTERN.test(normalizedPath)) return false;
  if (BOILERPLATE_FILENAMES.has(fileName)) return false;
  if (ORM_ARTIFACTS_PATTERN.test(normalizedPath)) return false;
  if (SKIP_PATTERN_LIST.some((pattern) => pattern.test(normalizedPath))) return false;

  return true;
}

export function findCoLocatedTest(filePath) {
  const fileName = basename(filePath);
  const extension = extname(filePath).toLowerCase();
  const baseName = fileName.replace(/\.(ts|tsx)$/i, '');
  const directory = dirname(filePath);

  const candidates = [
    join(directory, `${baseName}.test${extension}`),
    join(directory, `${baseName}.spec${extension}`),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function checkTddForFile(filePath) {
  if (!isCandidateForTddCheck(filePath)) {
    return { applies: false, ok: true };
  }
  const testFile = findCoLocatedTest(filePath);
  if (testFile) {
    return { applies: true, ok: true, testFile };
  }
  const fileName = basename(filePath);
  const extension = extname(filePath).toLowerCase();
  const baseName = fileName.replace(/\.(ts|tsx)$/i, '');
  return {
    applies: true,
    ok: false,
    expectedTestFile: `${baseName}.test${extension}`,
    fileName,
  };
}
