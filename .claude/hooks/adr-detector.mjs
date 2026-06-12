import { readPayload, emitAdditionalContext, safeMain } from './_lib.mjs';

const ARCHITECTURAL_PATTERNS = [
  /new layer/i,
  /new module/i,
  /new bounded context/i,
  /novo m[oó]dulo/i,
  /novo bounded context/i,
  /novo contexto/i,
  /swap database/i,
  /change database/i,
  /switch database/i,
  /trocar banco/i,
  /mudar banco/i,
  /migrar banco/i,
  /new adapter/i,
  /new port/i,
  /novo adapter/i,
  /nova porta/i,
  /refactor (the )?architecture/i,
  /redesenhar/i,
  /reestruturar/i,
  /new external service/i,
  /new integration/i,
  /nova integra[cç][aã]o/i,
  /novo servi[cç]o externo/i,
  /event[- ]driven/i,
  /event sourcing/i,
  /\bcqrs\b/i,
  /microservice/i,
  /extract service/i,
  /microservi[cç]o/i,
  /extrair servi[cç]o/i,
  /new aggregate/i,
  /novo agregado/i,
  /new domain/i,
  /architectural decision/i,
  /decis[aã]o arquitetural/i,
  /mudan[cç]a arquitetural/i,
];

safeMain(async () => {
  const payload = await readPayload();
  if (!payload) return;

  const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
  if (!prompt.trim()) return;

  const matched = ARCHITECTURAL_PATTERNS.some((pattern) => pattern.test(prompt));
  if (!matched) return;

  const reminder = [
    'Architectural change keywords detected in user prompt.',
    'Before implementing, follow skill:adr — verify if this requires creating or updating an ADR.',
    'Check existing ADRs in docs/adrs/ and confirm the architectural decision with the user before coding.',
  ].join('\n');

  emitAdditionalContext('UserPromptSubmit', reminder);
});
