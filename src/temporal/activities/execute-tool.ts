import { activityInfo, CancelledFailure } from '@temporalio/activity';
import { getToolExecute } from '../../adapter/tool-registry';
import type { ToolDispatchRequest, ToolDispatchResponse, SerializedToolResult } from '../../adapter/types';

/**
 * Generic tool execution Activity.
 *
 * Why it exists: Temporal Activities cannot capture closures or function references
 * across the serialization boundary. Instead, the original tool execute functions
 * are stored in the process-global tool registry (adapter/tool-registry.ts). This
 * Activity looks up the function by tool name, calls it with the deserialized params,
 * and returns the serialized result.
 *
 * Durability guarantee: once this Activity completes, its result is recorded in
 * Temporal Event History. On replay after Worker restart, the cached result is
 * returned — the original tool.execute is NOT called again. This is the
 * no-duplicate guarantee for all tool call types (CP-004, CP-008).
 *
 * AbortSignal bridge: if Temporal cancels this Activity (e.g., Workflow termination
 * or timeout), we abort the original tool's signal so it can clean up resources.
 */
export async function dispatchToolActivity(
  request: ToolDispatchRequest,
): Promise<ToolDispatchResponse> {
  const info = activityInfo();
  const startMs = Date.now();

  console.log(
    `[Activity] dispatchToolActivity — tool: ${request.toolName}, attempt: ${info.attempt}, ` +
    `workflowId: ${info.workflowExecution.workflowId}`,
  );

  // Look up the original tool execute function from the process-global registry.
  // This will throw if the tool is not registered (e.g., Worker restarted with different tools).
  const originalExecute = getToolExecute(request.toolName);

  // Create an AbortController so we can cancel the original execute if Temporal
  // cancels this Activity (e.g., Workflow timeout, termination, or manual cancel).
  const abortController = new AbortController();

  let rawResult: { content: Array<{ type: string; [key: string]: unknown }>; details?: unknown };

  try {
    rawResult = await originalExecute(
      request.toolCallId,
      request.params,
      abortController.signal,
    );
  } catch (err) {
    // If Temporal cancelled this Activity, re-throw as CancelledFailure for proper handling.
    if (abortController.signal.aborted) {
      throw new CancelledFailure(`Tool ${request.toolName} was cancelled`);
    }
    console.error(
      `[Activity] Tool failed — ${request.toolName}: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }

  // Serialize the result for Temporal's JSON payload.
  // AgentToolResult is JSONL-compatible by OpenClaw's design, so this is safe.
  const result: SerializedToolResult = {
    content: rawResult.content,
    details: rawResult.details,
  };

  const durationMs = Date.now() - startMs;
  console.log(
    `[Activity] dispatchToolActivity complete — tool: ${request.toolName}, ` +
    `${durationMs}ms, attempt: ${info.attempt}`,
  );

  return {
    toolCallId: request.toolCallId,
    result,
    durationMs,
  };
}
