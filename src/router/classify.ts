import { lookupTaxonomy, normalizeName } from './taxonomy';
import { resolveBridge, bridgeVersion, typeRisk } from './bridge';
import type { ExecutionConfig, ClassifyResult } from './types';

/**
 * The conservative default classification for unknown tools.
 *
 * Why side_effect_mutation: it's the safest unknown — we won't cache
 * (it might be a write), won't retry aggressively (might duplicate),
 * and won't skip idempotency (might have external side effects).
 * An idempotent_read default would silently cache writes; a
 * critical_transaction default would block every unknown call on HITL.
 */
const SAFE_DEFAULT: ExecutionConfig = {
  type: 'side_effect_mutation',
  retryPolicy: {
    maximumAttempts: 1,
    initialIntervalMs: 1000,
    backoffCoefficient: 1,
    maximumIntervalMs: 1000,
  },
  timeoutMs: 300000,
  cache: false,
  idempotent: false,
  compensation: undefined,
  hitl: 'none',
  thinkingCost: 'low',
};

/** SQL write keywords that promote a DB read to side_effect_mutation. */
const SQL_WRITE_RE = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE)\b/i;

/** AWS actions that promote to critical_transaction — prefix or exact match. */
const AWS_DESTRUCTIVE_RE = /(^|\b|(?=[A-Z]))(Delete|Terminate|Destroy|Purge|Remove)/;

/**
 * Check conditional overrides before the taxonomy lookup.
 *
 * Why hardcoded switch/if-else: these are the 7 documented edge cases from
 * TAXONOMY.md. Phase 1 doesn't need a rules engine — it needs the right answer
 * for the known dangerous cases. A rules engine adds indirection without adding
 * correctness for a fixed set of well-understood conditionals.
 *
 * Returns a ClassifyResult if an override applies, null otherwise.
 */
function checkConditionals(
  toolName: string,
  params: Record<string, unknown>,
): ClassifyResult | null {
  const normalized = normalizeName(toolName);

  // ── Git ────────────────────────────────────────────────────────────────────

  if (normalized === 'git' || normalized.startsWith('git-') || normalized.startsWith('git_')) {
    const command = String(params.command ?? params.args ?? '').toLowerCase();
    const isReadCommand =
      command.startsWith('status') ||
      command.startsWith('log') ||
      command.startsWith('diff') ||
      command.startsWith('show') ||
      command.startsWith('ls-files') ||
      command.startsWith('branch') ||
      command.startsWith('remote') ||
      command.startsWith('stash list');

    const isForcePush =
      command.includes('push') &&
      (command.includes('--force') || command.includes('-f'));

    if (isForcePush) {
      return {
        toolName,
        source: 'conditional',
        reason: 'git push --force detected — escalated to critical_transaction',
        config: {
          type: 'critical_transaction',
          retryPolicy: { maximumAttempts: 1, initialIntervalMs: 1000, backoffCoefficient: 1, maximumIntervalMs: 1000 },
          timeoutMs: 120000,
          cache: false,
          idempotent: false,
          compensation: 'git-revert',
          hitl: 'required',
          thinkingCost: 'low',
        },
      };
    }

    if (isReadCommand) {
      return {
        toolName,
        source: 'conditional',
        reason: `git read command (${command.split(' ')[0]}) — classified as idempotent_read`,
        config: {
          type: 'idempotent_read',
          retryPolicy: { maximumAttempts: 5, initialIntervalMs: 1000, backoffCoefficient: 2, maximumIntervalMs: 10000 },
          timeoutMs: 30000,
          cache: true,
          cacheTtlMs: 60000,
          idempotent: true,
          compensation: undefined,
          hitl: 'none',
          thinkingCost: 'low',
        },
      };
    }
  }

  // ── PostgreSQL / MySQL / SQLite / MongoDB — write detection ────────────────

  const isDbTool =
    normalized === 'postgresql' || normalized === 'postgres' || normalized === 'pg' ||
    normalized === 'mysql' || normalized === 'sqlite' || normalized === 'mongodb' ||
    normalized === 'mongo';

  if (isDbTool) {
    const sql = String(params.query ?? params.sql ?? params.statement ?? '');
    if (SQL_WRITE_RE.test(sql)) {
      const entry = lookupTaxonomy(toolName);
      const base = entry?.config ?? SAFE_DEFAULT;
      return {
        toolName,
        source: 'conditional',
        reason: `SQL write keyword detected in query — escalated to side_effect_mutation`,
        config: {
          ...base,
          type: 'side_effect_mutation',
          cache: false,
          idempotent: true,
          retryPolicy: { maximumAttempts: 1, initialIntervalMs: 1000, backoffCoefficient: 1, maximumIntervalMs: 1000 },
        },
      };
    }
  }

  // ── GitHub — merge on protected branch → critical_transaction ─────────────

  if (normalized === 'github-api' || normalized === 'github' || normalized === 'gh') {
    const action = String(params.action ?? params.method ?? '').toLowerCase();
    const target = String(params.base ?? params.target ?? params.branch ?? '').toLowerCase();
    const isProtectedMerge =
      action === 'merge' &&
      (target === 'main' || target === 'master' || target === 'production' || target === 'prod');

    if (isProtectedMerge) {
      return {
        toolName,
        source: 'conditional',
        reason: `GitHub merge targeting ${target} — escalated to critical_transaction`,
        config: {
          type: 'critical_transaction',
          retryPolicy: { maximumAttempts: 1, initialIntervalMs: 1000, backoffCoefficient: 1, maximumIntervalMs: 1000 },
          timeoutMs: 120000,
          cache: false,
          idempotent: false,
          compensation: 'revert-merge',
          hitl: 'required',
          thinkingCost: 'low',
        },
      };
    }
  }

  // ── Slack — waitForReply → human_interactive ───────────────────────────────

  if (normalized === 'slack' || normalized === 'slack-messaging') {
    if (params.waitForReply === true) {
      return {
        toolName,
        source: 'conditional',
        reason: 'Slack waitForReply: true — escalated to human_interactive',
        config: {
          type: 'human_interactive',
          retryPolicy: { maximumAttempts: 1, initialIntervalMs: 1000, backoffCoefficient: 1, maximumIntervalMs: 1000 },
          timeoutMs: 86400000,
          cache: false,
          idempotent: false,
          compensation: undefined,
          hitl: 'none',
          thinkingCost: 'low',
        },
      };
    }
  }

  // ── AWS — destructive action → critical_transaction ────────────────────────

  if (normalized === 'aws' || normalized === 'aws-sdk' || normalized === 's3' ||
      normalized === 'bedrock' || normalized === 'ecs') {
    const action = String(params.action ?? params.operation ?? params.method ?? params.apiMethod ?? '');
    if (AWS_DESTRUCTIVE_RE.test(action)) {
      return {
        toolName,
        source: 'conditional',
        reason: `AWS destructive action (${action}) — escalated to critical_transaction`,
        config: {
          type: 'critical_transaction',
          retryPolicy: { maximumAttempts: 1, initialIntervalMs: 1000, backoffCoefficient: 1, maximumIntervalMs: 1000 },
          timeoutMs: 300000,
          cache: false,
          idempotent: false,
          compensation: 'restore-aws-resource',
          hitl: 'required',
          thinkingCost: 'low',
        },
      };
    }
  }

  // ── Google Workspace — SendEmail is a write, not a read ───────────────────

  if (
    normalized === 'google-workspace' || normalized === 'gmail' ||
    normalized === 'google_workspace' || normalized === 'sendemail' ||
    normalized.startsWith('sendemail') || toolName.toLowerCase().includes('sendemail')
  ) {
    const toolNameLower = toolName.toLowerCase();
    const isWrite =
      toolNameLower.includes('send') ||
      toolNameLower.includes('create') ||
      toolNameLower.includes('write') ||
      String(params.action ?? '').toLowerCase().includes('send');

    if (isWrite || normalized === 'sendemail' || normalized.startsWith('sendemail')) {
      return {
        toolName,
        source: 'conditional',
        reason: 'Google Workspace write/send action — reclassified to side_effect_mutation',
        config: {
          type: 'side_effect_mutation',
          retryPolicy: { maximumAttempts: 2, initialIntervalMs: 1000, backoffCoefficient: 2, maximumIntervalMs: 30000 },
          timeoutMs: 60000,
          cache: false,
          idempotent: true,
          compensation: 'delete-created-resource',
          hitl: 'optional',
          thinkingCost: 'low',
        },
      };
    }
  }

  return null;
}

/**
 * Classify a tool call into an ExecutionConfig.
 *
 * Resolution order:
 * 1. Conditional overrides (hardcoded — git push --force, SQL writes, etc.)
 * 2. Taxonomy lookup (exact name or alias match, case-insensitive)
 * 3. Safe default (side_effect_mutation, 1 attempt, no cache)
 *
 * Why this order: conditionals must override taxonomy defaults because the
 * same tool name has different semantics depending on its parameters. The
 * taxonomy gives the right default for the common case. The safe default
 * ensures unknown tools never get silently cached or aggressively retried.
 */
export function classify(
  toolName: string,
  params: Record<string, unknown> = {},
): ClassifyResult {
  // 1. Conditional overrides.
  const conditional = checkConditionals(toolName, params);
  if (conditional) return conditional;

  // 2. Taxonomy lookup.
  const entry = lookupTaxonomy(toolName);
  if (entry) {
    return {
      toolName,
      config: entry.config,
      source: 'taxonomy',
      reason: `matched taxonomy entry: ${entry.name} (${entry.category})`,
    };
  }

  // 3. Bridge resolution — resolve ecosystem/marketing names to taxonomy tool tokens.
  const bridgeTools = resolveBridge(toolName);
  if (bridgeTools && bridgeTools.length > 0) {
    const resolved = bridgeTools
      .map(t => ({ tool: t, entry: lookupTaxonomy(t) }))
      .filter((r): r is { tool: string; entry: NonNullable<ReturnType<typeof lookupTaxonomy>> } => r.entry !== null);

    if (resolved.length > 0) {
      const picked = resolved.reduce((most, curr) =>
        typeRisk(curr.entry.config.type) > typeRisk(most.entry.config.type) ? curr : most
      );
      const toolList = bridgeTools.join(' + ');
      return {
        toolName,
        config: picked.entry.config,
        source: 'bridge',
        reason: `resolved ${toolName} → ${toolList} via bridge v${bridgeVersion()} (matched taxonomy: ${picked.entry.name})`,
      };
    }
  }

  // 4. Safe default for unknown tools.
  return {
    toolName,
    config: { ...SAFE_DEFAULT },
    source: 'default',
    reason: `unknown tool — applied conservative side_effect_mutation default`,
  };
}
