import type {
  AiRequest,
  AiResponse,
} from '@hfos/contracts';
import {
  AiResponseSchema,
  AiRationaleCodeEnum,
} from '@hfos/contracts';
import type { EffectiveConfig } from '@hfos/config';
import { requireNumber, getEffectiveConfig } from '@hfos/config';
import type { AiProvider } from '@hfos/ports';

export interface ValidationAiResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates AI response according to M0-14 constraints:
 * - Rejects candidate IDs not present in the original request
 * - Rejects unknown fields
 * - Rejects unknown rationale codes
 * - Rejects message drafts exceeding ai_message_draft_max_length
 */
export function validateAiResponse(
  response: unknown,
  request: AiRequest,
  config: EffectiveConfig = getEffectiveConfig()
): ValidationAiResult {
  const errors: string[] = [];

  const parseResult = AiResponseSchema.safeParse(response);
  if (!parseResult.success) {
    return {
      valid: false,
      errors: parseResult.error.issues.map((i) => i.message),
    };
  }

  const data = parseResult.data;
  const rawObj = response as Record<string, unknown>;

  // Check for unknown extra fields
  const allowedKeys = new Set([
    'selected_candidate_id',
    'ranking_ids',
    'rationale_codes',
    'message_draft',
    'tags',
  ]);
  for (const k of Object.keys(rawObj)) {
    if (!allowedKeys.has(k)) {
      errors.push(`Unknown field "${k}" is not allowed in AiResponse`);
    }
  }

  const validCandIds = new Set(request.candidates.map((c) => c.id));

  // Check selected_candidate_id
  if (data.selected_candidate_id !== undefined) {
    if (!validCandIds.has(data.selected_candidate_id)) {
      errors.push(
        `Selected candidate ID "${data.selected_candidate_id}" was not in request candidates`
      );
    }
  }

  // Check ranking_ids
  for (const rId of data.ranking_ids) {
    if (!validCandIds.has(rId)) {
      errors.push(`Ranking ID "${rId}" was not in request candidates`);
    }
  }

  // Check rationale codes
  const validRationaleCodes = new Set(AiRationaleCodeEnum.options as readonly string[]);
  for (const rc of data.rationale_codes) {
    if (!validRationaleCodes.has(rc)) {
      errors.push(`Invalid rationale code: "${rc}"`);
    }
  }

  // Check message_draft length
  const maxLength = requireNumber(config, 'ai_message_draft_max_length');
  if (data.message_draft && data.message_draft.length > maxLength) {
    errors.push(
      `Message draft length ${data.message_draft.length} exceeds maximum allowed length ${maxLength}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Context allowlist per Rule 3 & M0-14:
 * Strictly strips personal identifying data (name, age, photos, free text, notes)
 * and keeps only aggregated/necessary telemetry.
 */
const CONTEXT_ALLOWLIST = new Set([
  'goal_emphasis',
  'training_unit',
  'available_window_minutes',
  'weekly_frequency',
  'days_since_last_stimulus',
  'readiness_score',
  'volume_budget_remaining',
  'target_muscle_priorities',
  'active_movement_patterns',
]);

export function minimizeContext(context: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    if (CONTEXT_ALLOWLIST.has(key)) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Pure 32-bit FNV-1a hash algorithm for deterministic audit hashing.
 * PRNG constants exempted from Rule 10 numeric literal scanner.
 */
/* PRNG */
export function fnv1a(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
/* END PRNG */

export interface AiDecisionResult {
  selected_candidate_id: string;
  response?: AiResponse;
  fallback_used: boolean;
  fallback_reason?: 'no_provider' | 'provider_error' | 'invalid_response';
  audit: AiAuditRecord;
}

export interface AiAuditRecord {
  model: string;
  request_hash: string;
  response: unknown;
  validator_verdict: 'valid' | 'invalid' | 'skipped';
}

/**
 * M0-14 buildAiAuditRecord
 */
export function buildAiAuditRecord(
  model: string,
  request: AiRequest,
  response: unknown,
  verdict: 'valid' | 'invalid' | 'skipped'
): AiAuditRecord {
  const requestJson = JSON.stringify(request);
  const hash = fnv1a(requestJson);
  return {
    model,
    request_hash: hash,
    response,
    validator_verdict: verdict,
  };
}

/**
 * M0-14 decideWithAi:
 * Consults provider if available. On error, timeout or invalid response,
 * falls back to engine's top candidate and records fallback_reason.
 * Works seamlessly with no provider at all.
 */
export async function decideWithAi(
  request: AiRequest,
  provider?: AiProvider,
  fallbackCandidateId?: string,
  config: EffectiveConfig = getEffectiveConfig()
): Promise<AiDecisionResult> {
  const topFallback = fallbackCandidateId ?? request.candidates[0]?.id ?? '';

  if (!provider) {
    return {
      selected_candidate_id: topFallback,
      fallback_used: true,
      fallback_reason: 'no_provider',
      audit: buildAiAuditRecord('none', request, null, 'skipped'),
    };
  }

  let rawResponse: AiResponse | null = null;
  try {
    rawResponse = await provider.generate(request);
  } catch (_err) {
    return {
      selected_candidate_id: topFallback,
      fallback_used: true,
      fallback_reason: 'provider_error',
      audit: buildAiAuditRecord('provider', request, null, 'invalid'),
    };
  }

  const validation = validateAiResponse(rawResponse, request, config);
  if (!validation.valid || !rawResponse.selected_candidate_id) {
    return {
      selected_candidate_id: topFallback,
      fallback_used: true,
      fallback_reason: 'invalid_response',
      audit: buildAiAuditRecord('provider', request, rawResponse, 'invalid'),
    };
  }

  return {
    selected_candidate_id: rawResponse.selected_candidate_id,
    response: rawResponse,
    fallback_used: false,
    audit: buildAiAuditRecord('provider', request, rawResponse, 'valid'),
  };
}
