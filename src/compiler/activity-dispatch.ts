import { proxyActivities } from '@temporalio/workflow';
import type { ExecutionConfig } from '../router/types';

/**
 * Activity dispatch mapper — bridges the SER router's ExecutionConfig
 * to Temporal ActivityOptions.
 *
 * Why it exists: the SER router classifies each step with a full ExecutionConfig
 * (retry policy, timeout, idempotency, heartbeat). This module translates that
 * config into Temporal's ActivityOptions format so the workflow-builder can
 * proxy activities with the correct settings per step.
 *
 * Pattern: mirrors temporal-ai-agent's `workflow_helpers.execute_activity` approach —
 * one generic Activity (executeSkillStep) dispatched by tool name with per-call options,
 * rather than generating per-tool Activity classes.
 */

/** Input passed to the executeSkillStep Activity. */
export interface SkillStepInput {
  stepId: string;
  toolName: string;
  params: Record<string, unknown>;
  idempotencyKey?: string;
}

/** Output returned by the executeSkillStep Activity. */
export interface SkillStepOutput {
  stepId: string;
  toolName: string;
  result: unknown;
  durationMs: number;
}

/** Input passed to the executeThinkingStep Activity. */
export interface ThinkingStepInput {
  stepId: string;
  prompt: string;
  modelTier: string;
  tokenBudget: number;
  /** Results from prior steps, passed as context to the LLM. */
  priorContext: Array<{ stepId: string; result: unknown }>;
}

/** Output returned by the executeThinkingStep Activity. */
export interface ThinkingStepOutput {
  stepId: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Convert an ExecutionConfig's retryPolicy to Temporal RetryPolicy format.
 */
export function toTemporalRetryPolicy(config: ExecutionConfig): {
  maximumAttempts: number;
  initialInterval: string;
  backoffCoefficient: number;
  maximumInterval: string;
} {
  const { retryPolicy } = config;
  return {
    maximumAttempts: retryPolicy.maximumAttempts,
    initialInterval: `${retryPolicy.initialIntervalMs}ms`,
    backoffCoefficient: retryPolicy.backoffCoefficient,
    maximumInterval: `${retryPolicy.maximumIntervalMs}ms`,
  };
}

/**
 * Build ActivityOptions for a tool_call step from its ExecutionConfig.
 * The options are passed directly to proxyActivities() in the workflow.
 */
export function toActivityOptions(config: ExecutionConfig): Parameters<typeof proxyActivities>[0] {
  const base: Parameters<typeof proxyActivities>[0] = {
    startToCloseTimeout: `${config.timeoutMs}ms`,
    retry: toTemporalRetryPolicy(config),
  };

  // Stateful sessions need heartbeat monitoring.
  if (config.type === 'stateful_session' && config.heartbeatIntervalMs) {
    base.heartbeatTimeout = `${config.heartbeatIntervalMs * 2}ms`;
  }

  return base;
}

/**
 * ActivityOptions for thinking steps — mirrors zeitlich's proxyRunAgent defaults:
 * startToCloseTimeout: 10m, heartbeatTimeout: 1m, retry maximumAttempts: 3.
 */
export const THINKING_ACTIVITY_OPTIONS: Parameters<typeof proxyActivities>[0] = {
  startToCloseTimeout: '10m',
  heartbeatTimeout: '1m',
  retry: {
    maximumAttempts: 3,
    initialInterval: '10s',
    maximumInterval: '2m',
    backoffCoefficient: 3,
  },
};
