import { Client, Connection, WorkflowHandle, WorkflowNotFoundError } from '@temporalio/client';
import type { AgentSessionInput, AgentSessionResult } from '../temporal/workflows/agent-session';

const TASK_QUEUE = 'tenure-task-queue';

/**
 * Manages the mapping between OpenClaw session IDs and Temporal Workflow IDs.
 *
 * Why it exists: the adapter design constraint requires one long-lived Workflow
 * per OpenClaw session, already running when the first tool call arrives. This
 * class ensures that Workflow exists and provides handles for sending Updates.
 *
 * The Workflow ID is deterministically derived from the session ID so the adapter
 * can reconnect to the same Workflow after a Worker restart without needing
 * additional state storage.
 */
export class SessionManager {
  private readonly client: Client;
  private readonly taskQueue: string;
  private readonly handleCache = new Map<string, WorkflowHandle<typeof import('../temporal/workflows/agent-session').agentSessionWorkflow>>();

  constructor(client: Client, taskQueue = TASK_QUEUE) {
    this.client = client;
    this.taskQueue = taskQueue;
  }

  /**
   * Returns a handle to the Workflow for this session, starting it if needed.
   *
   * The Workflow ID is `tenure-{sessionId}` — deterministic, restartable.
   * If the Workflow is already running (e.g., after adapter reconnect), returns
   * a handle to the existing execution.
   */
  async getOrCreateWorkflow(
    sessionId: string,
  ): Promise<WorkflowHandle<typeof import('../temporal/workflows/agent-session').agentSessionWorkflow>> {
    const cached = this.handleCache.get(sessionId);
    if (cached) {
      return cached;
    }

    const workflowId = `tenure-${sessionId}`;
    let handle: WorkflowHandle<typeof import('../temporal/workflows/agent-session').agentSessionWorkflow>;

    // Check if an execution is already running.
    try {
      const existing = this.client.workflow.getHandle(workflowId);
      // Probe: fetch description to verify it exists and is still running.
      const desc = await existing.describe();
      const isRunning = desc.status.code === 1; // RUNNING = 1
      if (isRunning) {
        console.log(`[SessionManager] Reconnected to existing Workflow: ${workflowId}`);
        handle = existing as typeof handle;
        this.handleCache.set(sessionId, handle);
        return handle;
      }
    } catch (err) {
      // WorkflowNotFoundError or WORKFLOW_NOT_FOUND means we need to start one.
      if (!(err instanceof WorkflowNotFoundError) && !(err as Error).message?.includes('not found')) {
        throw err;
      }
    }

    // Start a new Workflow for this session.
    // Using `startDelay: 0` ensures it's scheduled immediately — the hook must
    // not return until the Workflow is running and ready to receive Updates.
    handle = await this.client.workflow.start('agentSessionWorkflow', {
      taskQueue: this.taskQueue,
      workflowId,
      args: [{ sessionId } satisfies AgentSessionInput],
    }) as typeof handle;

    console.log(`[SessionManager] Started Workflow: ${workflowId}`);
    this.handleCache.set(sessionId, handle);
    return handle;
  }

  /** Terminate a session's Workflow (called when the OpenClaw session ends). */
  async terminateSession(sessionId: string, reason = 'Session ended'): Promise<void> {
    const workflowId = `tenure-${sessionId}`;
    try {
      const handle = this.client.workflow.getHandle(workflowId);
      await handle.terminate(reason);
      this.handleCache.delete(sessionId);
      console.log(`[SessionManager] Terminated Workflow: ${workflowId}`);
    } catch (err) {
      if ((err as Error).message?.includes('not found')) {
        // Already gone — that's fine.
        this.handleCache.delete(sessionId);
      } else {
        throw err;
      }
    }
  }

  /** Evict from local cache (does not affect Temporal). */
  evictCache(sessionId: string): void {
    this.handleCache.delete(sessionId);
  }

  /** Create a SessionManager connected to a local Temporal dev server. */
  static async create(
    temporalAddress = 'localhost:7233',
    taskQueue = TASK_QUEUE,
  ): Promise<SessionManager> {
    const connection = await Connection.connect({ address: temporalAddress });
    const client = new Client({ connection });
    return new SessionManager(client, taskQueue);
  }
}

/** Singleton session manager, initialized by tenureConnect(). */
let _sessionManager: SessionManager | null = null;

export function setSessionManager(sm: SessionManager): void {
  _sessionManager = sm;
}

export function getSessionManager(): SessionManager {
  if (!_sessionManager) {
    throw new Error(
      '[SessionManager] Not initialized. Call tenureConnect() before dispatching tool calls.',
    );
  }
  return _sessionManager;
}
