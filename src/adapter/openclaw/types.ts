/**
 * JSON-serializable types for crossing the Temporal Activity boundary.
 *
 * OpenClaw's AgentToolResult contains content blocks and arbitrary details.
 * We serialize these as-is (they're JSONL-compatible by design) and let the
 * deserializing side reconstruct whatever shape it needs.
 */

/** A single content block as produced by OpenClaw's AgentTool. */
export interface ToolContentBlock {
  type: 'text' | 'image' | string;
  [key: string]: unknown;
}

/** Serializable form of AgentToolResult — passed across the Temporal boundary. */
export interface SerializedToolResult {
  content: ToolContentBlock[];
  details?: unknown;
  /** Set to true when the Activity result came from Temporal history (not re-executed). */
  fromCache?: boolean;
}

/** The dispatch request sent to the Workflow via Update. */
export interface ToolDispatchRequest {
  toolCallId: string;
  toolName: string;
  /** JSON-serialized params from OpenClaw's tool_use decision. */
  params: Record<string, unknown>;
}

/** The response returned by the Workflow Update handler. */
export interface ToolDispatchResponse {
  toolCallId: string;
  result: SerializedToolResult;
  durationMs: number;
}

/**
 * The execute function signature from @mariozechner/pi-agent-core's AgentTool.
 *
 * We define it here as a duck type so the adapter does not depend on OpenClaw's
 * package directly — keeping Tenure's adapter decoupled from OpenClaw's exact version.
 */
export type ExecuteFunction = (
  toolCallId: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
  onUpdate?: (update: unknown) => void,
) => Promise<{ content: ToolContentBlock[]; details?: unknown }>;

/**
 * Minimal duck type for any tool that has a name and an execute function.
 * Matches AnyAgentTool from OpenClaw without importing it directly.
 */
export interface TenureTool {
  name: string;
  execute: ExecuteFunction;
  [key: string]: unknown;
}

/** Configuration for the Tenure adapter. */
export interface TenureConnectOptions {
  /** OpenClaw session ID — maps to one Temporal Workflow. */
  sessionId: string;
  /** The tools array from OpenClaw. Each tool.execute will be wrapped. */
  tools: TenureTool[];
  /** Optional Temporal server address. Defaults to localhost:7233. */
  temporalAddress?: string;
  /** Optional task queue. Defaults to tenure-task-queue. */
  taskQueue?: string;
}
