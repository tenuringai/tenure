import type { ExecuteFunction } from './types';

/**
 * Process-global registry of original tool execute functions, keyed by tool name.
 *
 * Why it exists: Temporal Activities can only receive and return JSON-serializable data.
 * We cannot pass a closure or function reference through Temporal's message boundary.
 * Instead, the adapter registers each tool's original execute function here before the
 * Worker starts. When the generic Activity fires, it looks up the function from this
 * registry and calls it with the deserialized params.
 *
 * Lifecycle: populated by tenureConnect() before Worker starts, remains alive for the
 * Worker process lifetime. Each tool name maps to its original execute function.
 */
const registry = new Map<string, ExecuteFunction>();

/** Register a tool's original execute function under its name. */
export function registerTool(toolName: string, execute: ExecuteFunction): void {
  if (registry.has(toolName)) {
    console.warn(`[ToolRegistry] Overwriting existing registration for tool: ${toolName}`);
  }
  registry.set(toolName, execute);
}

/** Retrieve a registered execute function by tool name. Throws if not found. */
export function getToolExecute(toolName: string): ExecuteFunction {
  const fn = registry.get(toolName);
  if (!fn) {
    throw new Error(
      `[ToolRegistry] No execute function registered for tool: "${toolName}". ` +
      `Registered tools: ${[...registry.keys()].join(', ') || '(none)'}`,
    );
  }
  return fn;
}

/** List all registered tool names (for diagnostics). */
export function listRegisteredTools(): string[] {
  return [...registry.keys()];
}

/** Clear the registry (for testing). */
export function clearRegistry(): void {
  registry.clear();
}
