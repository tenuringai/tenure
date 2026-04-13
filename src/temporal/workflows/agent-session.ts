import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  workflowInfo,
} from '@temporalio/workflow';
import type { ExecuteToolParams, ExecuteToolResult } from '../activities/execute-tool';

/**
 * Type-only import — Activities are never imported as values inside Workflow code.
 * The Workflow sandbox has no access to Node APIs (fs, crypto, net, etc.).
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type Activities = { executeTool: (params: ExecuteToolParams) => Promise<ExecuteToolResult> };

/**
 * Proxy connects the Workflow (sandbox) to Activities (main process).
 * On replay, completed Activities return their cached result from Event History
 * without re-executing — this is the no-duplicate guarantee.
 */
const { executeTool } = proxyActivities<Activities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '10 seconds',
  },
});

/** Adapter constraint: the Workflow receives tool calls via Signal, not at start time.
 * This enables the long-lived session pattern — one Workflow per OpenClaw session,
 * already running when the before_tool_call hook fires. */
export const executeToolSignal = defineSignal<[ExecuteToolParams]>('executeToolSignal');

/** Query the result of the last completed tool execution. */
export const lastResultQuery = defineQuery<ExecuteToolResult | null>('lastResult');

export interface AgentSessionInput {
  sessionId: string;
}

export interface AgentSessionResult {
  sessionId: string;
  completedToolCalls: number;
  lastResult: ExecuteToolResult | null;
}

/**
 * Long-lived agent session Workflow.
 *
 * Architecture constraint: this Workflow stays alive for the duration of an OpenClaw
 * session. Tool calls arrive via Signals from the adapter hook (Task 2). Each Signal
 * dispatches the tool call as a Temporal Activity. The hook blocks until it receives
 * the Activity result, then returns it to OpenClaw as if the tool call happened normally.
 *
 * For Task 1 (foundation proof), we demonstrate the basic Activity-caching guarantee:
 * execute one tool call, crash, replay returns the cached result.
 */
export async function agentSessionWorkflow(
  input: AgentSessionInput,
): Promise<AgentSessionResult> {
  const info = workflowInfo();
  console.log(`[Workflow] agentSessionWorkflow started — sessionId: ${input.sessionId}, workflowId: ${info.workflowId}`);

  let pendingParams: ExecuteToolParams | null = null;
  let lastResult: ExecuteToolResult | null = null;
  let completedToolCalls = 0;
  let shouldComplete = false;

  setHandler(executeToolSignal, (params: ExecuteToolParams) => {
    console.log(`[Workflow] received executeToolSignal — ${JSON.stringify(params)}`);
    pendingParams = params;
  });

  setHandler(lastResultQuery, () => lastResult);

  // Process incoming tool calls until the session ends.
  // In Task 1, we stop after the first tool call completes (shouldComplete = true).
  // In Task 2, this loop runs until OpenClaw sends a shutdown signal.
  while (!shouldComplete) {
    // Wait until a tool call arrives via Signal.
    await condition(() => pendingParams !== null);

    const params = pendingParams!;
    pendingParams = null;

    // Execute the tool call as an Activity.
    // On replay after Worker restart, this line returns the cached result
    // from Temporal Event History — the Activity does NOT re-execute.
    lastResult = await executeTool(params);
    completedToolCalls++;

    console.log(`[Workflow] tool call complete — total: ${completedToolCalls}, hash: ${lastResult.hash}`);

    // Task 1: complete after first tool call to prove the foundation.
    // Task 2 will remove this and loop until a shutdown Signal arrives.
    shouldComplete = true;
  }

  return {
    sessionId: input.sessionId,
    completedToolCalls,
    lastResult,
  };
}
