import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from '../../temporal/activities/execute-tool';
import { SessionManager, setSessionManager } from './session';
import { wrapTool } from './wrap-tool';
import type { TenureConnectOptions } from './types';

export { wrapTool, isWrapped } from './wrap-tool';
export { registerTool, getToolExecute, listRegisteredTools } from './tool-registry';
export { SessionManager, getSessionManager, setSessionManager } from './session';
export type { TenureTool, TenureConnectOptions, ToolDispatchRequest, ToolDispatchResponse, SerializedToolResult } from './types';

const DEFAULT_TEMPORAL_ADDRESS = 'localhost:7233';
const DEFAULT_TASK_QUEUE = 'tenure-task-queue';

/**
 * Result of a successful tenureConnect() call.
 */
export interface TenureConnection {
  /** The wrapped tools — pass these to OpenClaw instead of the originals. */
  tools: ReturnType<typeof wrapTool>[];
  /** Session manager for lifecycle operations (terminate session, etc.). */
  sessionManager: SessionManager;
  /** Temporal Worker — call worker.run() to start polling. */
  worker: Worker;
  /** Stop the connection gracefully. */
  shutdown: () => Promise<void>;
}

/**
 * Connect Tenure to an OpenClaw session.
 *
 * This is the main entry point for the OpenClaw adapter. It:
 * 1. Creates a Temporal client + session manager
 * 2. Ensures the session Workflow is started (so it's ready when the first tool call arrives)
 * 3. Wraps every tool's execute function to route through Temporal
 * 4. Creates a Temporal Worker that registers the generic dispatchToolActivity
 * 5. Returns the wrapped tools — replace the original tools array in your OpenClaw setup
 *
 * Usage:
 * ```typescript
 * const { tools, worker, shutdown } = await tenureConnect({
 *   sessionId: openClawSessionId,
 *   tools: openClawTools,
 * });
 * // Start the worker in background
 * worker.run(); // don't await — runs indefinitely
 * // Use wrapped tools in OpenClaw
 * createAgentSession({ tools, ... });
 * // On session end:
 * await shutdown();
 * ```
 *
 * Adapter design constraint: the hook is a doorway, not a vault.
 * tenureConnect() must be called BEFORE OpenClaw starts executing tool calls.
 * The Workflow is started here so it's already running when the first tool call fires.
 */
export async function tenureConnect(options: TenureConnectOptions): Promise<TenureConnection> {
  const {
    sessionId,
    tools,
    temporalAddress = DEFAULT_TEMPORAL_ADDRESS,
    taskQueue = DEFAULT_TASK_QUEUE,
  } = options;

  console.log(`[Tenure] Connecting — sessionId: ${sessionId}, tools: ${tools.map(t => t.name).join(', ')}`);

  // 1. Create the session manager and initialize the singleton.
  const sessionManager = await SessionManager.create(temporalAddress, taskQueue);
  setSessionManager(sessionManager);

  // 2. Pre-start the session Workflow so it's running before the first tool call.
  // This eliminates Workflow start latency from the critical path (the hook-to-Temporal window).
  await sessionManager.getOrCreateWorkflow(sessionId);

  // 3. Wrap every tool's execute function.
  // registerTool() is called inside wrapTool() for each tool.
  const wrappedTools = tools.map(tool => wrapTool(tool, sessionId));
  console.log(`[Tenure] Wrapped ${wrappedTools.length} tools`);

  // 4. Create the Temporal Worker with the generic dispatchToolActivity.
  // The Worker must be created after registerTool() calls so the registry is populated.
  const connection = await NativeConnection.connect({ address: temporalAddress });
  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue,
    // Workflows run in an isolated V8 sandbox — referenced by path.
    workflowsPath: require.resolve('../../temporal/workflows/agent-session'),
    // Activities run in the main process — they can access the tool registry.
    activities,
  });

  console.log(`[Tenure] Worker created — task queue: ${taskQueue}`);

  const shutdown = async (): Promise<void> => {
    console.log(`[Tenure] Shutting down session: ${sessionId}`);
    await sessionManager.terminateSession(sessionId);
    worker.shutdown();
    console.log(`[Tenure] Shutdown complete`);
  };

  return {
    tools: wrappedTools,
    sessionManager,
    worker,
    shutdown,
  };
}
