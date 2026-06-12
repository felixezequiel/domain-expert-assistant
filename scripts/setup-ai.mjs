// AI tooling setup for this template (cross-platform: Windows / macOS / Linux).
//
// By default this template ships skills and hooks under .claude/ which Claude Code
// discovers automatically — no setup needed for the local project.
//
// This script is OPTIONAL. Use it to install the same skills and hooks GLOBALLY
// at the user's HOME so they apply to every project on this machine.
//
// Usage (from repo root):
//   node scripts/setup-ai.mjs              install globally
//   node scripts/setup-ai.mjs --verify     only verify node + report what would be installed

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const SOURCE_CLAUDE_DIR = join(REPO_ROOT, '.claude');
const TARGET_CLAUDE_DIR = join(homedir(), '.claude');

const verifyOnly = process.argv.includes('--verify') || process.argv.includes('-v');

function fail(message) {
  process.stderr.write(`[ERR] ${message}\n`);
  process.exit(1);
}

function countSkills() {
  const skillsRoot = join(SOURCE_CLAUDE_DIR, 'skills');
  if (!existsSync(skillsRoot)) return 0;
  return readdirSync(skillsRoot).filter((entry) => {
    const fullPath = join(skillsRoot, entry);
    return statSync(fullPath).isDirectory();
  }).length;
}

function countHookFiles() {
  const hooksRoot = join(SOURCE_CLAUDE_DIR, 'hooks');
  if (!existsSync(hooksRoot)) return 0;
  return readdirSync(hooksRoot).filter((entry) => entry.endsWith('.mjs')).length;
}

process.stdout.write('DDD Template - AI tooling setup\n');
process.stdout.write(`  Source: ${SOURCE_CLAUDE_DIR}\n`);
process.stdout.write(`  Target: ${TARGET_CLAUDE_DIR}\n\n`);

if (!existsSync(SOURCE_CLAUDE_DIR)) {
  fail(`Source .claude/ folder not found at ${SOURCE_CLAUDE_DIR}`);
}

const nodeMajorVersion = Number(process.versions.node.split('.')[0]);
const REQUIRED_NODE_MAJOR = 24;
if (Number.isFinite(nodeMajorVersion) && nodeMajorVersion < REQUIRED_NODE_MAJOR) {
  fail(`Node ${REQUIRED_NODE_MAJOR}+ required (current: ${process.versions.node})`);
}

const skillsCount = countSkills();
const hooksCount = countHookFiles();
const settingsExists = existsSync(join(SOURCE_CLAUDE_DIR, 'settings.json'));

process.stdout.write('Inventory:\n');
process.stdout.write(`  Skills: ${skillsCount}\n`);
process.stdout.write(`  Hooks:  ${hooksCount}\n`);
process.stdout.write(`  settings.json: ${settingsExists ? 'yes' : 'no'}\n\n`);

if (verifyOnly) {
  process.stdout.write('[OK] Verification complete. Re-run without --verify to install globally.\n');
  process.exit(0);
}

mkdirSync(TARGET_CLAUDE_DIR, { recursive: true });

const sourceSkills = join(SOURCE_CLAUDE_DIR, 'skills');
const targetSkills = join(TARGET_CLAUDE_DIR, 'skills');
if (existsSync(sourceSkills)) {
  mkdirSync(targetSkills, { recursive: true });
  for (const skillName of readdirSync(sourceSkills)) {
    const sourceSkillDir = join(sourceSkills, skillName);
    if (!statSync(sourceSkillDir).isDirectory()) continue;
    const targetSkillDir = join(targetSkills, skillName);
    mkdirSync(targetSkillDir, { recursive: true });
    const sourceSkillFile = join(sourceSkillDir, 'SKILL.md');
    if (existsSync(sourceSkillFile)) {
      cpSync(sourceSkillFile, join(targetSkillDir, 'SKILL.md'));
      process.stdout.write(`[OK] skill: ${skillName}\n`);
    }
  }
}

const sourceHooks = join(SOURCE_CLAUDE_DIR, 'hooks');
const targetHooks = join(TARGET_CLAUDE_DIR, 'hooks');
if (existsSync(sourceHooks)) {
  if (existsSync(targetHooks)) {
    rmSync(targetHooks, { recursive: true, force: true });
  }
  cpSync(sourceHooks, targetHooks, { recursive: true });
  process.stdout.write(`[OK] hooks (recursive copy of ${sourceHooks})\n`);
}

process.stdout.write(`\nDone. Skills and hooks installed at ${TARGET_CLAUDE_DIR}\n\n`);
process.stdout.write('NOTE: settings.json was NOT copied. The project-local .claude/settings.json\n');
process.stdout.write('      uses relative paths (node .claude/hooks/foo.mjs) that work for the\n');
process.stdout.write('      project own .claude/ folder. For global use, write your own\n');
process.stdout.write('      $HOME/.claude/settings.json (Linux/macOS) or %USERPROFILE%\\.claude\\settings.json\n');
process.stdout.write('      (Windows) pointing to the absolute paths under the global hooks/ folder.\n');
