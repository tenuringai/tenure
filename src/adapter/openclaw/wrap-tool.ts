import { getSessionManager } from './session';
import { registerTool } from './tool-registry';
import { dispatchToolUpdate } from '../../temporal/workflows/agent-session';
import type { TenureTool, ToolDispatchRequest } from './types';

/** Symbol marker to detect double-wrapping. */
const TENURE_WRAPPED = Symbol('tenure.wrapped');

/**
 * Wraps a single tool's execute function to route through Temporal.
 *
 * The original execute function is:
 * 1. Saved in the process-global tool registry (for Activity lookup)
 * 2. Replaced on the tool object with a Temporal-dispatching version
 *
 * The new execute:
 * 1. Gets the session Workflow handle (starts it if not running)
 * 2. Sends a dispatchToolUpdate — blocks until the Activity completes
 * 3. Returns the Activity result to OpenClaw as a normal tool result
 *
 * OpenClaw sees no difference — a normal tool call that returned a result.
 * Temporal has a durable record of every execution on the timeline.
 *
 * The crash window is: adapter calls executeUpdate() → Temporal Server acknowledges
 * the Update → Activity is scheduled. This is single-digit milliseconds over localhost.
 * After acknowledgement, the execution is durable regardless of process state.
 */
export function wrapTool(tool: TenureTool, sessionId: string): TenureTool {
  // Avoid double-wrapping if tenureConnect is called multiple times.
  if ((tool as unknown as Record<symbol, boolean>)[TENURE_WRAPPED]) {
    return tool;
  }

  if (typeof tool.execute !== 'function') {
    console.warn(`[wrapTool] Tool "${tool.name}" has no execute function — skipping`);
    return tool;
  }

  // Save the original execute in the registry.
  // The Activity will call this function by looking up tool.name.
  const originalExecute = tool.execute;
  registerTool(tool.name, originalExecute);

  /**
   * Replacement execute function — dispatches through Temporal.
   *
   * Signature matches AgentTool.execute exactly:
   * (toolCallId: string, params: Record<string, unknown>, signal?, onUpdate?) => Promise<result>
   */
  const tenureExecute = async (
    toolCallId: string,
    params: Record<string, unknown>,
    _signal?: AbortSignal,
    _onUpdate?: (update: unknown) => void,
  ): Promise<{ content: Array<{ type: string; [key: string]: unknown }>; details?: unknown }> => {
    const request: ToolDispatchRequest = {
      toolCallId,
      toolName: tool.name,
      params,
    };

    console.log(
      `[Adapter] Dispatching "${tool.name}" through Temporal — sessionId: ${sessionId}, toolCallId: ${toolCallId}`,
    );

    // Get the session Workflow (starts it if this is the first call in the session).
    const sessionManager = getSessionManager();
    const handle = await sessionManager.getOrCreateWorkflow(sessionId);

    // Execute Update — this BLOCKS until the Temporal Activity completes.
    // Once Temporal Server acknowledges the Update, the call is on the durable timeline.
    // If the Worker dies between here and the response, replay will return the
    // cached Activity result from Event History — the tool will NOT run again.
    const response = await handle.executeUpdate(dispatchToolUpdate, { args: [request] });

    console.log(
      `[Adapter] "${tool.name}" completed via Temporal — ${response.durationMs}ms`,
    );

    // Return the result in OpenClaw's expected shape.
    return {
      content: response.result.content,
      details: response.result.details,
    };
  };

  // Install the wrapped execute and mark it.
  tool.execute = tenureExecute as TenureTool['execute'];
  (tool as unknown as Record<symbol, boolean>)[TENURE_WRAPPED] = true;

  return tool;
}

/** Check if a tool has already been wrapped by Tenure. */
export function isWrapped(tool: TenureTool): boolean {
  return Boolean((tool as unknown as Record<symbol, boolean>)[TENURE_WRAPPED]);
}
