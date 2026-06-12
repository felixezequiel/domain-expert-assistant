// Runs tests only for files changed in git compared to HEAD.
// Cross-platform replacement for the bash version.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const PRODUCTION_TEST_SUFFIX = '.test.ts';
const SOURCE_FILE_SUFFIX = '.ts';

function getChangedTypeScriptFiles() {
  let stdout;
  try {
    stdout = execFileSync(
      'git',
      ['-C', REPO_ROOT, 'diff', '--name-only', '--diff-filter=ACMR', 'HEAD', '--', 'src'],
      { encoding: 'utf8' },
    );
  } catch {
    return [];
  }

  const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.filter((relativePath) => relativePath.endsWith(SOURCE_FILE_SUFFIX));
}

function toAbsolute(relativePath) {
  return resolve(REPO_ROOT, relativePath);
}

function deriveTestFile(relativePath) {
  if (relativePath.endsWith(PRODUCTION_TEST_SUFFIX)) {
    return relativePath;
  }
  const withoutExtension = relativePath.slice(0, -SOURCE_FILE_SUFFIX.length);
  return `${withoutExtension}${PRODUCTION_TEST_SUFFIX}`;
}

const changedFiles = getChangedTypeScriptFiles();
const testFilesSet = new Set();

for (const relativePath of changedFiles) {
  const candidateTestFile = deriveTestFile(relativePath);
  const absoluteCandidate = toAbsolute(candidateTestFile);
  if (existsSync(absoluteCandidate)) {
    testFilesSet.add(candidateTestFile);
  }
}

const testFiles = Array.from(testFilesSet).sort();

if (testFiles.length === 0) {
  process.stdout.write('No changed test files found.\n');
  process.exit(0);
}

process.stdout.write(`Running ${testFiles.length} test file(s):\n`);
for (const file of testFiles) {
  process.stdout.write(`  ${file}\n`);
}
process.stdout.write('\n');

const normalizedTestFiles = testFiles.map((file) => file.split(sep).join('/'));
const nodeArgs = ['--import', '@swc-node/register/esm-register', '--test', ...normalizedTestFiles];

const child = spawnSync(process.execPath, nodeArgs, {
  cwd: REPO_ROOT,
  stdio: 'inherit',
});

process.exit(child.status ?? 1);
