const DOMAIN_PATH_PATTERN = /\/domain\//i;
const APPLICATION_PATH_PATTERN = /\/application\//i;
const INFRASTRUCTURE_PATH_PATTERN = /\/(infrastructure|infra|adapter|adapters)\//i;

const IMPORT_LINE_PATTERN = /^\s*import\s/;

const DOMAIN_FORBIDDEN_INFRA_IMPORT = /from\s+["'][^"']*\b(infrastructure|infra|adapter|adapters)\b/i;
const DOMAIN_FORBIDDEN_APPLICATION_IMPORT = /from\s+["'][^"']*\b(application|usecase|use_case|use-case)\b/i;
const DOMAIN_FORBIDDEN_FRAMEWORK_IMPORT = /from\s+["']@?(mikro-orm|graphql|nodemailer)/i;

const APPLICATION_FORBIDDEN_INFRA_IMPORT = /from\s+["'][^"']*\b(infrastructure|infra|adapter|adapters)\b/i;
const APPLICATION_PORT_ESCAPE_HATCH = /\b(port|ports|interface)\b/i;
const APPLICATION_FORBIDDEN_MIKROORM_IMPORT = /from\s+["']@mikro-orm/i;

const MAX_REPORTED_VIOLATIONS = 5;

function normalizePath(value) {
  return value.replace(/\\/g, '/').toLowerCase();
}

export function classifyLayer(filePath) {
  const normalized = normalizePath(filePath);
  if (INFRASTRUCTURE_PATH_PATTERN.test(normalized)) return 'infrastructure';
  if (DOMAIN_PATH_PATTERN.test(normalized)) return 'domain';
  if (APPLICATION_PATH_PATTERN.test(normalized)) return 'application';
  return 'other';
}

function findDomainViolations(line, lineNumber) {
  const violations = [];
  if (DOMAIN_FORBIDDEN_INFRA_IMPORT.test(line)) {
    violations.push(`L${lineNumber}: domain importing from infrastructure: ${line.trim()}`);
  }
  if (DOMAIN_FORBIDDEN_APPLICATION_IMPORT.test(line)) {
    violations.push(`L${lineNumber}: domain importing from application: ${line.trim()}`);
  }
  if (DOMAIN_FORBIDDEN_FRAMEWORK_IMPORT.test(line)) {
    violations.push(`L${lineNumber}: domain importing framework: ${line.trim()}`);
  }
  return violations;
}

function findApplicationViolations(line, lineNumber) {
  const violations = [];
  if (APPLICATION_FORBIDDEN_INFRA_IMPORT.test(line) && !APPLICATION_PORT_ESCAPE_HATCH.test(line)) {
    violations.push(`L${lineNumber}: application importing concrete infra (use ports): ${line.trim()}`);
  }
  if (APPLICATION_FORBIDDEN_MIKROORM_IMPORT.test(line)) {
    violations.push(`L${lineNumber}: application importing MikroORM directly: ${line.trim()}`);
  }
  return violations;
}

export function checkHexagonalForFile(filePath, content) {
  const layer = classifyLayer(filePath);
  if (layer !== 'domain' && layer !== 'application') {
    return { applies: false, ok: true, layer };
  }

  const lines = content.split(/\r?\n/);
  const violations = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!IMPORT_LINE_PATTERN.test(line)) continue;

    const lineNumber = index + 1;
    const lineViolations = layer === 'domain'
      ? findDomainViolations(line, lineNumber)
      : findApplicationViolations(line, lineNumber);

    violations.push(...lineViolations);
    if (violations.length >= MAX_REPORTED_VIOLATIONS) break;
  }

  return {
    applies: true,
    ok: violations.length === 0,
    layer,
    violations: violations.slice(0, MAX_REPORTED_VIOLATIONS),
  };
}
