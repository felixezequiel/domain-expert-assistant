import { appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { hooksDir, readPayload, safeMain } from './_lib.mjs';

const STATE_DIR = resolve(hooksDir(), '..', '.state');

safeMain(async () => {
  const payload = await readPayload();
  if (!payload) return;

  const sessionId = payload.session_id;
  if (typeof sessionId !== 'string' || !sessionId.trim()) return;

  const filePath = payload.tool_input?.file_path ?? payload.tool_response?.filePath;
  if (typeof filePath !== 'string' || !filePath.trim()) return;

  try {
    mkdirSync(STATE_DIR, { recursive: true });
    const stateFile = join(STATE_DIR, `doc-sync-${sessionId}.txt`);
    appendFileSync(stateFile, `${filePath}\n`, { encoding: 'utf8' });
  } catch {
    // Tracking is best-effort; never fail the harness.
  }
});
