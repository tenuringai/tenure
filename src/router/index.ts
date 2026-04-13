/**
 * Semantic Execution Router — public API.
 *
 * Why it exists: every tool call dispatched through Tenure passes through
 * classify() before reaching the Temporal Activity proxy. The result
 * determines retry policy, timeout, caching strategy, idempotency key
 * generation, and whether to gate on human approval.
 *
 * Usage:
 *   import { classify } from './router';
 *   const { config, source, reason } = classify('stripe', { idempotencyKey: 'abc' });
 *   // config.type === 'critical_transaction'
 *   // config.hitl === 'required'
 */
export { classify } from './classify';
export { lookupTaxonomy, normalizeName, taxonomySize } from './taxonomy';
export type {
  ExecutionType,
  ExecutionConfig,
  RetryPolicy,
  ClassifyResult,
  TaxonomyEntry,
  HitlLevel,
  ThinkingCost,
} from './types';
