// Runs all unit tests, excluding integration and performance tests.
// Cross-platform replacement for the bash version (Windows + macOS + Linux).

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const SRC_DIR = join(REPO_ROOT, 'src');

const EXCLUDED_DIR_NAMES = new Set(['integrationTests', 'performanceTests', 'node_modules']);
const TEST_FILE_SUFFIX = '.test.ts';

function collectTestFiles(absoluteDir, accumulator) {
  let entries;
  try {
    entries = readdirSync(absoluteDir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = join(absoluteDir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry)) continue;
      collectTestFiles(fullPath, accumulator);
      continue;
    }
    if (stats.isFile() && entry.endsWith(TEST_FILE_SUFFIX)) {
      accumulator.push(fullPath);
    }
  }
}

const testFiles = [];
collectTestFiles(SRC_DIR, testFiles);
testFiles.sort();

const fileCount = testFiles.length;
process.stdout.write(`Running ${fileCount} unit test files...\n\n`);

if (fileCount === 0) {
  process.exit(0);
}

const relativeFiles = testFiles.map((absolute) => absolute.slice(REPO_ROOT.length + 1).split(sep).join('/'));

const nodeArgs = ['--import', '@swc-node/register/esm-register', '--test', ...relativeFiles];
const child = spawnSync(process.execPath, nodeArgs, {
  cwd: REPO_ROOT,
  stdio: 'inherit',
});

process.exit(child.status ?? 1);
