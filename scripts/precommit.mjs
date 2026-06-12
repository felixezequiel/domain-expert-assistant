import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTddForFile } from '../.claude/hooks/checks/tdd-check.mjs';
import { checkHexagonalForFile } from '../.claude/hooks/checks/hexagonal-check.mjs';
import { checkPlainObjectForFile } from '../.claude/hooks/checks/plainobject-check.mjs';
import { checkReadableCodeForFile } from '../.claude/hooks/checks/readable-code-check.mjs';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

function getStagedFiles() {
  try {
    const stdout = execFileSync(
      'git',
      ['-C', REPO_ROOT, 'diff', '--cached', '--name-only', '--diff-filter=ACM'],
      { encoding: 'utf8' },
    );
    return stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
  } catch {
    return [];
  }
}

function readStagedContent(relativePath) {
  try {
    return execFileSync('git', ['-C', REPO_ROOT, 'show', `:${relativePath}`], { encoding: 'utf8' });
  } catch {
    return null;
  }
}

const blockingErrors = [];
const warnings = [];

function blockingError(file, message) {
  blockingErrors.push({ file, message });
}

function warning(file, message) {
  warnings.push({ file, message });
}

const stagedFiles = getStagedFiles();

if (stagedFiles.length === 0) {
  process.stdout.write('No staged files. Skipping AI tooling checks.\n');
  process.exit(0);
}

for (const relativePath of stagedFiles) {
  const absolutePath = resolve(REPO_ROOT, relativePath);
  const stagedContent = readStagedContent(relativePath);
  const fileExists = existsSync(absolutePath);

  const tddResult = checkTddForFile(absolutePath);
  if (tddResult.applies && !tddResult.ok) {
    blockingError(
      relativePath,
      `Missing co-located test "${tddResult.expectedTestFile}" next to ${tddResult.fileName}. (skill:tdd-workflow)`,
    );
  }

  if (stagedContent !== null) {
    const hexagonalResult = checkHexagonalForFile(absolutePath, stagedContent);
    if (hexagonalResult.applies && !hexagonalResult.ok) {
      const violations = hexagonalResult.violations.join('\n      ');
      blockingError(
        relativePath,
        `${hexagonalResult.layer} layer leaks dependency: \n      ${violations}\n      (skill:hexagonal-architecture)`,
      );
    }

    const plainObjectResult = checkPlainObjectForFile(absolutePath, stagedContent);
    if (plainObjectResult.applies && !plainObjectResult.ok) {
      blockingError(
        relativePath,
        `ORM entity class(es) ${plainObjectResult.classes.join(', ')} must "extends PlainObject" from @mikro-orm/core. (skill:hexagonal-architecture)`,
      );
    }
  }

  if (fileExists) {
    let content;
    try {
      content = readFileSync(absolutePath, 'utf8');
    } catch {
      content = null;
    }
    if (content) {
      const readableResult = checkReadableCodeForFile(absolutePath, content);
      if (readableResult.applies && !readableResult.ok) {
        for (const finding of readableResult.findings) {
          warning(relativePath, finding.message);
        }
      }
    }
  }
}

if (warnings.length > 0) {
  process.stdout.write('\n[warn] skill:readable-code findings (non-blocking):\n');
  for (const item of warnings) {
    process.stdout.write(`  - ${item.file}\n      ${item.message}\n`);
  }
}

if (blockingErrors.length > 0) {
  process.stderr.write('\n[block] AI tooling pre-commit checks failed:\n');
  for (const item of blockingErrors) {
    process.stderr.write(`  - ${item.file}: ${item.message}\n`);
  }
  process.stderr.write(
    '\nFix the issues above and re-stage. To bypass intentionally: git commit --no-verify (not recommended).\n',
  );
  process.exit(1);
}

process.stdout.write(`\nAI tooling pre-commit checks passed (${stagedFiles.length} file(s) inspected).\n`);
process.exit(0);
