import type { KnowledgeFact, InformationNeed } from '@hfos/contracts';
import type { EffectiveConfig } from '@hfos/config';
import { requireNumber, getEffectiveConfig } from '@hfos/config';

export interface KnowledgeLedger {
  facts: Record<string, KnowledgeFact>;
  rejected_inferences: string[];
}

/**
 * Creates an initial immutable KnowledgeLedger.
 */
export function createKnowledgeLedger(
  facts: Record<string, KnowledgeFact> = {},
  rejected_inferences: string[] = []
): KnowledgeLedger {
  return {
    facts: { ...facts },
    rejected_inferences: [...rejected_inferences],
  };
}

/**
 * Upserts a fact into the immutable ledger.
 * Inferred facts for previously rejected keys are prohibited.
 */
export function upsertFact(
  ledger: KnowledgeLedger,
  fact: KnowledgeFact
): KnowledgeLedger {
  if (fact.source === 'inferred' && ledger.rejected_inferences.includes(fact.key)) {
    // Rejected inferred fact is not recorded
    return ledger;
  }

  return {
    facts: {
      ...ledger.facts,
      [fact.key]: fact,
    },
    rejected_inferences: [...ledger.rejected_inferences],
  };
}

/**
 * Retrieves a fact from the ledger.
 * If the fact was inferred and later rejected, returns undefined.
 */
export function getFact(
  ledger: KnowledgeLedger,
  key: string
): KnowledgeFact | undefined {
  if (ledger.rejected_inferences.includes(key)) {
    const existing = ledger.facts[key];
    if (existing && existing.source === 'inferred') {
      return undefined;
    }
  }
  return ledger.facts[key];
}

/**
 * Rejects an inferred fact key.
 * The inference is purged and never used again.
 */
export function rejectInference(
  ledger: KnowledgeLedger,
  key: string
): KnowledgeLedger {
  const updatedFacts = { ...ledger.facts };
  const existing = updatedFacts[key];
  if (existing && existing.source === 'inferred') {
    delete updatedFacts[key];
  }

  const newRejected = ledger.rejected_inferences.includes(key)
    ? ledger.rejected_inferences
    : [...ledger.rejected_inferences, key];

  return {
    facts: updatedFacts,
    rejected_inferences: newRejected,
  };
}

/**
 * Freshness policy lookup from config:
 * - weight: freshness_days_weight
 * - waist: freshness_days_waist
 * - baseline_test: freshness_days_baseline_test
 * - equipment: freshness_days_equipment
 */
export function getFreshnessDaysForKey(
  key: string,
  config: EffectiveConfig = getEffectiveConfig()
): number {
  if (key === 'weight' || key === 'bodyweight') {
    return requireNumber(config, 'freshness_days_weight');
  }
  if (key === 'waist') {
    return requireNumber(config, 'freshness_days_waist');
  }
  if (key === 'baseline_test') {
    return requireNumber(config, 'freshness_days_baseline_test');
  }
  if (key === 'equipment') {
    return requireNumber(config, 'freshness_days_equipment');
  }
  return requireNumber(config, 'freshness_days_weight');
}

/**
 * Determines if a KnowledgeFact is stale according to configured freshness policy.
 */
export function isStale(
  fact: KnowledgeFact,
  now: string,
  config: EffectiveConfig = getEffectiveConfig()
): boolean {
  const nowMs = Date.parse(now);

  // Check explicit expiry if present
  if (fact.expires_at) {
    const expMs = Date.parse(fact.expires_at);
    if (nowMs >= expMs) {
      return true;
    }
  }

  const freshnessDays = getFreshnessDaysForKey(fact.key, config);
  const msPerDay = requireNumber(config, 'milliseconds_per_day');

  const updatedMs = Date.parse(fact.updated_at);
  const ageMs = nowMs - updatedMs;

  return ageMs > freshnessDays * msPerDay;
}

export interface DecisionContext {
  decision_class: string;
  required_facts: string[];
  consumer: string;
}

/**
 * M0-12 deriveInformationNeeds:
 * Returns an InformationNeed ONLY when a requested decision requires a fact that is missing or stale.
 * Deduplicated; at most max_questions_per_day.
 */
export function deriveInformationNeeds(
  decisionContext: DecisionContext,
  ledger: KnowledgeLedger,
  now: string,
  config: EffectiveConfig = getEffectiveConfig()
): InformationNeed[] {
  const maxQuestions = requireNumber(config, 'max_questions_per_day');
  const needs: InformationNeed[] = [];
  const seenKeys = new Set<string>();

  for (const key of decisionContext.required_facts) {
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const fact = getFact(ledger, key);
    const missing = !fact;
    const stale = fact ? isStale(fact, now, config) : false;

    if (missing || stale) {
      const reason = missing
        ? `Fact "${key}" is required for ${decisionContext.decision_class} but missing.`
        : `Fact "${key}" is stale and must be refreshed for accurate ${decisionContext.decision_class}.`;

      needs.push({
        schema_version: 1,
        id: '018f6c38-89c0-7b56-8a5b-000000000001',
        question_key: key,
        reason,
        consumer: decisionContext.consumer,
        priority: missing ? 'urgent' : 'high',
        created_at: now,
        expires_at: now,
      });

      if (needs.length >= maxQuestions) {
        break;
      }
    }
  }

  return needs;
}
