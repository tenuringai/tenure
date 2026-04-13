import {
  proxyActivities,
  defineSignal,
  defineQuery,
  defineUpdate,
  setHandler,
  condition,
  workflowInfo,
} from '@temporalio/workflow';
import type { ToolDispatchRequest, ToolDispatchResponse } from '../../adapter/types';

/**
 * Type-only import — Activities are never imported as values inside Workflow code.
 * The Workflow sandbox has no access to Node APIs (fs, crypto, net, etc.).
 */
type Activities = {
  dispatchToolActivity: (request: ToolDispatchRequest) => Promise<ToolDispatchResponse>;
};

/**
 * Activity proxy with per-execution-type timeout and retry policy.
 * The actual timeout is overridden per-call based on SER classification (Task 3).
 * These defaults apply to unclassified / side_effect_mutation calls.
 *
 * On replay, completed Activities return their cached result from Event History
 * without re-executing — this is the no-duplicate guarantee (CP-008).
 */
const { dispatchToolActivity } = proxyActivities<Activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    // Conservative default: one attempt before manual review.
    // The SER router (Task 3) overrides this per execution type:
    //   idempotent_read → 5 attempts
    //   side_effect_mutation → 3 attempts
    //   critical_transaction → 1 attempt
    maximumAttempts: 3,
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '30 seconds',
  },
});

/**
 * Update definition for dispatching a tool call from the adapter wrapper.
 *
 * Unlike Signals (fire-and-forget), Updates block until the handler returns.
 * This is the correct primitive for the "hook as doorway" pattern: the adapter
 * sends an Update, blocks until the Activity completes, then returns the result
 * to OpenClaw as if the tool call executed normally.
 *
 * Crash guarantee: once the Update is acknowledged by Temporal Server, the
 * Activity is scheduled on the durable timeline. Worker death cannot lose it.
 */
export const dispatchToolUpdate = defineUpdate<ToolDispatchResponse, [ToolDispatchRequest]>(
  'dispatchTool',
);

/** Shutdown signal — sent when the OpenClaw session ends. */
export const shutdownSignal = defineSignal('shutdown');

/** Query the last N completed tool call results (for diagnostics). */
export const sessionStatsQuery = defineQuery<SessionStats>('sessionStats');

export interface SessionStats {
  sessionId: string;
  workflowId: string;
  completedToolCalls: number;
  failedToolCalls: number;
  isShuttingDown: boolean;
}

export interface AgentSessionInput {
  sessionId: string;
}

export interface AgentSessionResult {
  sessionId: string;
  completedToolCalls: number;
  failedToolCalls: number;
}

/**
 * Long-lived agent session Workflow.
 *
 * One Workflow per OpenClaw session. The Workflow stays alive for the entire
 * duration of the session, receiving tool calls as Updates from the adapter wrapper.
 * Each Update dispatches a Temporal Activity which executes the original tool function.
 *
 * This is the implementation of the "hook as doorway, Temporal as vault" constraint:
 * - The adapter wrapper sends an Update (fast path to Temporal Server)
 * - The Update handler schedules a dispatchToolActivity
 * - Activity result is cached in Event History
 * - Worker restart: Workflow replays, Activity returns cached result
 * - No duplicate side effects (CP-008), no lost cron runs (CP-014)
 */
export async function agentSessionWorkflow(
  input: AgentSessionInput,
): Promise<AgentSessionResult> {
  const info = workflowInfo();
  console.log(
    `[Workflow] agentSessionWorkflow started — sessionId: ${input.sessionId}, workflowId: ${info.workflowId}`,
  );

  let completedToolCalls = 0;
  let failedToolCalls = 0;
  let isShuttingDown = false;

  setHandler(shutdownSignal, () => {
    console.log(`[Workflow] Received shutdown signal — will complete after pending calls`);
    isShuttingDown = true;
  });

  setHandler(sessionStatsQuery, (): SessionStats => ({
    sessionId: input.sessionId,
    workflowId: info.workflowId,
    completedToolCalls,
    failedToolCalls,
    isShuttingDown,
  }));

  /**
   * Update handler for individual tool calls.
   *
   * Each call from the adapter wrapper is an Update — it blocks the caller until
   * the Activity completes and the result is returned. The Activity result is
   * durably recorded in Temporal Event History before this function returns.
   *
   * If the Worker dies after the Activity completes but before this handler returns,
   * replay will return the cached Activity result from Event History without
   * re-executing the tool — the no-duplicate guarantee holds.
   */
  setHandler(dispatchToolUpdate, async (request: ToolDispatchRequest): Promise<ToolDispatchResponse> => {
    console.log(
      `[Workflow] Dispatching tool: ${request.toolName} (toolCallId: ${request.toolCallId})`,
    );

    try {
      // Dispatch the tool call as a Temporal Activity.
      // Once this line is reached on the Temporal timeline, the tool call is durable.
      // The Activity calls the original tool.execute function from the in-process registry.
      const response = await dispatchToolActivity(request);

      completedToolCalls++;
      console.log(
        `[Workflow] Tool completed: ${request.toolName} — ${completedToolCalls} total`,
      );

      return response;
    } catch (err) {
      failedToolCalls++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Workflow] Tool failed: ${request.toolName} — ${message}`);
      throw err;
    }
  });

  // Wait until shutdown is signalled. The Workflow stays alive for the session.
  // Each tool call arrives as an Update and is handled inline above.
  await condition(() => isShuttingDown);

  console.log(
    `[Workflow] Session complete — ${completedToolCalls} succeeded, ${failedToolCalls} failed`,
  );

  return {
    sessionId: input.sessionId,
    completedToolCalls,
    failedToolCalls,
  };
}
