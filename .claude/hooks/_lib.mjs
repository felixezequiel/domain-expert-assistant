import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HOOKS_DIR = dirname(fileURLToPath(import.meta.url));

export function hooksDir() {
  return HOOKS_DIR;
}

export function readPayload() {
  return new Promise((resolve) => {
    let raw = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => {
        raw += chunk;
      });
      process.stdin.on('end', () => {
        if (!raw.trim()) {
          finish(null);
          return;
        }
        try {
          finish(JSON.parse(raw));
        } catch {
          finish(null);
        }
      });
      process.stdin.on('error', () => finish(null));
    } catch {
      finish(null);
    }
    setTimeout(() => finish(null), 8000).unref();
  });
}

export function emitAdditionalContext(eventName, message) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: eventName,
        additionalContext: message,
      },
    }),
  );
}

export function emitAskPermission(eventName, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: eventName,
        permissionDecision: 'ask',
        permissionDecisionReason: reason,
      },
    }),
  );
}

export function emitStopBlock(reason) {
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason,
    }),
  );
}

export function normalizePath(value) {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/\\/g, '/');
}

export function splitLines(content) {
  if (!content) return [];
  return content.split(/\r?\n/);
}

export async function safeMain(fn) {
  try {
    await fn();
  } catch {
    // Hooks must never crash the harness — fail open.
  } finally {
    process.exit(0);
  }
}
