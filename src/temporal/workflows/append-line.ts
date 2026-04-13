import { proxyActivities } from '@temporalio/workflow';
import type { AppendLineInput, AppendLineResult } from '../activities/append-line';

/**
 * Activity proxy for the append-line Activity.
 * Short timeout: the file append is fast; if it takes >30s something is wrong.
 * Single attempt: we don't retry file appends to avoid duplicates.
 */
const { appendLineActivity } = proxyActivities<{
  appendLineActivity: (input: AppendLineInput) => Promise<AppendLineResult>;
}>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 1 },
});

/**
 * Schedule-triggered Workflow: appends one line to the proof log.
 *
 * Why it exists: Temporal Schedules fire Workflow executions, not raw Activities.
 * This thin Workflow wraps the appendLineActivity so the Schedule has a target.
 * Each Schedule trigger → one Workflow execution → one Activity → one file append.
 *
 * The Workflow itself is deterministic (no side effects). The Activity does the
 * actual file I/O. On replay after crash, the completed Activity returns its
 * cached result — no duplicate append.
 */
export async function appendLineWorkflow(input: AppendLineInput): Promise<AppendLineResult> {
  return await appendLineActivity(input);
}
