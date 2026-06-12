import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const HOOKS_DIR = join(REPO_ROOT, '.claude', 'hooks');

const TEMP_DIR = mkdtempSync(join(tmpdir(), 'ddd-hooks-test-'));

function runHook(hookFile, payload) {
  return new Promise((resolveRun) => {
    const child = spawn('node', [join(HOOKS_DIR, hookFile)], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (exitCode) => {
      let parsed = null;
      const trimmed = stdout.trim();
      if (trimmed.length > 0) {
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          parsed = null;
        }
      }
      resolveRun({ exitCode, stdout: trimmed, stderr, parsed });
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

const cases = [];

function expect(label, condition, detail = '') {
  cases.push({ label, ok: condition, detail });
}

async function testAdrDetector() {
  const triggered = await runHook('adr-detector.mjs', { prompt: 'Vamos criar um novo bounded context para Pagamentos.' });
  expect('adr-detector triggers on architectural keyword', triggered.parsed?.hookSpecificOutput?.additionalContext?.includes('skill:adr'));

  const ignored = await runHook('adr-detector.mjs', { prompt: 'Apenas adicione um log aqui.' });
  expect('adr-detector stays silent on irrelevant prompt', ignored.stdout.length === 0);

  const malformed = await runHook('adr-detector.mjs', { not_a_prompt: 1 });
  expect('adr-detector handles malformed payload gracefully', malformed.exitCode === 0);
}

async function testTddChecker() {
  const fakeProductionPath = join(TEMP_DIR, 'src', 'modules', 'fake', 'domain', 'Foo.ts');
  const triggered = await runHook('tdd-checker.mjs', {
    tool_input: { file_path: fakeProductionPath, content: 'export class Foo {}' },
  });
  expect('tdd-checker reminds when test file missing', triggered.parsed?.hookSpecificOutput?.additionalContext?.includes('skill:tdd-workflow'));

  const skipped = await runHook('tdd-checker.mjs', {
    tool_input: { file_path: join(TEMP_DIR, 'src', 'modules', 'fake', 'domain', 'Foo.test.ts') },
  });
  expect('tdd-checker stays silent on test files', skipped.stdout.length === 0);

  const skippedConfig = await runHook('tdd-checker.mjs', {
    tool_input: { file_path: join(TEMP_DIR, 'eslint.config.ts') },
  });
  expect('tdd-checker stays silent on config files', skippedConfig.stdout.length === 0);
}

async function testReadableCodeChecker() {
  const filePath = join(TEMP_DIR, 'magic.ts');
  writeFileSync(
    filePath,
    [
      'export function compute(input: number) {',
      '  return input * 9999;',
      '}',
    ].join('\n'),
    'utf8',
  );
  const triggered = await runHook('readable-code-checker.mjs', {
    tool_input: { file_path: filePath },
  });
  expect('readable-code flags magic numbers', triggered.parsed?.hookSpecificOutput?.additionalContext?.includes('Magic numbers'));

  const cleanFilePath = join(TEMP_DIR, 'clean.ts');
  writeFileSync(cleanFilePath, 'export const HTTP_OK = 200;\nexport const value = HTTP_OK;\n', 'utf8');
  const cleanResult = await runHook('readable-code-checker.mjs', {
    tool_input: { file_path: cleanFilePath },
  });
  expect('readable-code accepts allowed HTTP status code', cleanResult.stdout.length === 0);
}

async function testHexagonalValidator() {
  const triggered = await runHook('hexagonal-validator.mjs', {
    tool_input: {
      file_path: join(TEMP_DIR, 'src', 'modules', 'fake', 'domain', 'Foo.ts'),
      content: ["import { EntityManager } from '@mikro-orm/core';", 'export class Foo {}'].join('\n'),
    },
  });
  expect('hexagonal-validator asks before allowing forbidden import', triggered.parsed?.hookSpecificOutput?.permissionDecision === 'ask');

  const allowed = await runHook('hexagonal-validator.mjs', {
    tool_input: {
      file_path: join(TEMP_DIR, 'src', 'modules', 'fake', 'application', 'ports', 'FooRepositoryPort.ts'),
      content: 'export interface FooRepositoryPort {}',
    },
  });
  expect('hexagonal-validator stays silent for clean application code', allowed.stdout.length === 0);
}

async function testPrTemplateValidator() {
  const goodCommand = `gh pr create --title "feat: x" --body "$(cat <<'EOF'\n## Summary\n- Did stuff\n\n## Test plan\n- npm test\nEOF\n)"`;
  const goodResult = await runHook('pr-template-validator.mjs', { tool_input: { command: goodCommand } });
  expect('pr-template-validator accepts a complete PR body', goodResult.stdout.length === 0);

  const badCommand = `gh pr create --title "feat: x" --body "Just a quick note"`;
  const badResult = await runHook('pr-template-validator.mjs', { tool_input: { command: badCommand } });
  expect('pr-template-validator asks when sections are missing', badResult.parsed?.hookSpecificOutput?.permissionDecision === 'ask');

  const irrelevant = await runHook('pr-template-validator.mjs', { tool_input: { command: 'npm test' } });
  expect('pr-template-validator ignores non-PR commands', irrelevant.stdout.length === 0);
}

async function testDocSyncCycle() {
  const sessionId = 'smoke-test-session';
  const trackerResult = await runHook('doc-sync-tracker.mjs', {
    session_id: sessionId,
    tool_input: { file_path: join(TEMP_DIR, 'src', 'foo.ts') },
  });
  expect('doc-sync-tracker exits cleanly', trackerResult.exitCode === 0);

  const blockResult = await runHook('doc-sync-checker.mjs', { session_id: sessionId });
  expect('doc-sync-checker blocks when only code changed', blockResult.parsed?.decision === 'block');

  const trackerWithDoc = await runHook('doc-sync-tracker.mjs', {
    session_id: `${sessionId}-with-doc`,
    tool_input: { file_path: join(TEMP_DIR, 'src', 'foo.ts') },
  });
  expect('doc-sync-tracker exits cleanly (doc case)', trackerWithDoc.exitCode === 0);
  await runHook('doc-sync-tracker.mjs', {
    session_id: `${sessionId}-with-doc`,
    tool_input: { file_path: join(TEMP_DIR, 'README.md') },
  });
  const allowResult = await runHook('doc-sync-checker.mjs', { session_id: `${sessionId}-with-doc` });
  expect('doc-sync-checker stays silent when docs were updated', allowResult.stdout.length === 0);
}

async function testSafeRefactoringChecker() {
  const result = await runHook('safe-refactoring-checker.mjs', {
    tool_input: {
      file_path: join(REPO_ROOT, 'src', 'main.ts'),
      old_string: 'a\nb\nc\nd\ne\nf\ng\n',
    },
  });
  expect('safe-refactoring-checker exits cleanly outside refactor branch', result.exitCode === 0);
}

async function testPlainObjectChecker() {
  const violation = await runHook('plainobject-checker.mjs', {
    tool_input: {
      file_path: join(TEMP_DIR, 'src', 'modules', 'fake', 'infrastructure', 'persistence', 'mikro-orm', 'entities', 'FooEntity.ts'),
      content: 'export class FooEntity {\n  id!: string;\n}',
    },
  });
  expect('plainobject-checker asks when PlainObject is missing', violation.parsed?.hookSpecificOutput?.permissionDecision === 'ask');

  const compliant = await runHook('plainobject-checker.mjs', {
    tool_input: {
      file_path: join(TEMP_DIR, 'src', 'modules', 'fake', 'infrastructure', 'persistence', 'mikro-orm', 'entities', 'FooEntity.ts'),
      content: "import { PlainObject } from '@mikro-orm/core';\nexport class FooEntity extends PlainObject { id!: string; }",
    },
  });
  expect('plainobject-checker accepts compliant entity', compliant.stdout.length === 0);
}

await testAdrDetector();
await testTddChecker();
await testReadableCodeChecker();
await testHexagonalValidator();
await testPrTemplateValidator();
await testDocSyncCycle();
await testSafeRefactoringChecker();
await testPlainObjectChecker();

const failures = cases.filter((c) => !c.ok);
const passed = cases.length - failures.length;

for (const c of cases) {
  const marker = c.ok ? 'PASS' : 'FAIL';
  process.stdout.write(`[${marker}] ${c.label}\n`);
  if (!c.ok && c.detail) {
    process.stdout.write(`       ${c.detail}\n`);
  }
}

process.stdout.write(`\n${passed}/${cases.length} hook checks passed\n`);
process.exit(failures.length === 0 ? 0 : 1);
