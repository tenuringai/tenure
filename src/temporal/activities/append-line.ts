import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Input for the append-line Activity.
 *
 * The Activity reads the current line count from the file, increments it,
 * and appends a new line. This makes each invocation self-sequencing —
 * no external counter needed.
 */
export interface AppendLineInput {
  logFile: string;
}

export interface AppendLineResult {
  sequence: number;
  timestamp: string;
  logFile: string;
}

/**
 * Side-effecting Activity: appends a sequenced, timestamped line to a log file.
 *
 * Why it exists: this is the observable side effect for the standalone
 * cron-durability proof. Temporal's Schedule triggers a Workflow which calls
 * this Activity. After a SIGKILL + restart, the catchupWindow policy causes
 * missed triggers to fire, and each one produces exactly one append — proving
 * no gaps and no duplicates survive a crash.
 *
 * Self-sequencing: reads the current file to determine the next sequence number.
 * This is safe because each Schedule execution is serialized (overlap: SKIP).
 */
export async function appendLineActivity(
  input: AppendLineInput,
): Promise<AppendLineResult> {
  await fs.mkdir(path.dirname(input.logFile), { recursive: true });

  let currentCount = 0;
  try {
    const existing = await fs.readFile(input.logFile, 'utf-8');
    currentCount = existing.trim().split('\n').filter(l => l.length > 0).length;
  } catch {
    // File doesn't exist yet — start at 0.
  }

  const sequence = currentCount + 1;
  const timestamp = new Date().toISOString();
  const line = `${sequence}|${timestamp}\n`;

  await fs.appendFile(input.logFile, line, 'utf-8');

  console.log(
    `[Activity] appendLine — seq: ${sequence}, file: ${input.logFile}`,
  );

  return { sequence, timestamp, logFile: input.logFile };
}
