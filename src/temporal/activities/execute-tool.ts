import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { activityInfo } from '@temporalio/activity';

/** Params for executing a tool call that writes a file. */
export interface ExecuteToolParams {
  filePath: string;
  content: string;
}

/** Result recorded in Temporal Event History — never re-executed on replay. */
export interface ExecuteToolResult {
  hash: string;
  written: boolean;
  filePath: string;
}

/**
 * Simulates a side-effecting tool call: writes a file and returns a content hash.
 *
 * This Activity exists to prove the core Tenure guarantee: once this Activity completes,
 * its result is recorded in Temporal Event History. If the Worker dies before the result
 * is delivered to the next Workflow step, replay returns the cached result without
 * re-executing this function — the file is written exactly once.
 *
 * This is the no-duplicate write proof from the crash matrix (CP-004, CP-008).
 */
export async function executeTool(params: ExecuteToolParams): Promise<ExecuteToolResult> {
  const info = activityInfo();
  console.log(`[Activity] executeTool starting — attempt ${info.attempt}, workflowId: ${info.workflowExecution.workflowId}`);

  await fs.writeFile(params.filePath, params.content, 'utf-8');

  const hash = crypto.createHash('sha256').update(params.content).digest('hex');

  console.log(`[Activity] executeTool complete — wrote ${params.filePath}, sha256: ${hash}`);

  return {
    hash,
    written: true,
    filePath: params.filePath,
  };
}
