import * as fs from 'fs/promises';
import * as path from 'path';
import { parseFrontmatter } from '../parser/frontmatter';
import { classify } from '../router';

/**
 * Skill scanner — classifies all SKILL.md files in a directory.
 *
 * Why it exists: `tenure scan ./skills` gives skill authors a classification
 * report: which execution type each skill has, whether the contract is declared
 * explicitly, and whether the classification came from the author's execution block,
 * the taxonomy, or the safe default.
 *
 * The scanner now uses the parser's frontmatter extraction instead of a separate
 * parse-skill implementation — a single extraction path for all SKILL.md files.
 *
 * Output format:
 *   Skill                  Type                    Source      Status
 *   ────────────────────────────────────────────────────────────────
 *   cron-log-writer        side_effect_mutation    execution:  tenured
 *   web-search             idempotent_read         taxonomy    classified
 *   my-custom-skill        side_effect_mutation    default     unclassified
 */

export interface ClassificationReport {
  entries: ClassificationEntry[];
  total: number;
  tenured: number;
  classified: number;
  unclassified: number;
}

export interface ClassificationEntry {
  skillName: string;
  filePath: string;
  executionType: string;
  allowedTools: string[];
  source: 'execution:' | 'metadata:' | 'taxonomy' | 'default';
  status: 'tenured' | 'classified' | 'unclassified';
  error?: string;
}

/**
 * Scan a directory for SKILL.md files and classify each one.
 * Prints the classification table and returns the report.
 */
export async function scan(directory: string): Promise<ClassificationReport> {
  const resolvedDir = path.resolve(directory);

  console.log(`[tenure scan] Scanning: ${resolvedDir}`);

  const skillFiles = await findSkillFiles(resolvedDir);

  if (skillFiles.length === 0) {
    console.log(`[tenure scan] No SKILL.md files found in ${resolvedDir}`);
    return { entries: [], total: 0, tenured: 0, classified: 0, unclassified: 0 };
  }

  const entries: ClassificationEntry[] = [];

  for (const filePath of skillFiles) {
    const entry = await classifySkillFile(filePath);
    entries.push(entry);
  }

  const report: ClassificationReport = {
    entries,
    total: entries.length,
    tenured: entries.filter(e => e.status === 'tenured').length,
    classified: entries.filter(e => e.status === 'classified').length,
    unclassified: entries.filter(e => e.status === 'unclassified' || e.error).length,
  };

  printReport(report);
  return report;
}

/**
 * Recursively find all SKILL.md files in a directory.
 */
async function findSkillFiles(directory: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name === 'SKILL.md') {
        found.push(fullPath);
      }
    }
  }

  await walk(directory);
  return found.sort();
}

/**
 * Classify a single SKILL.md file.
 */
async function classifySkillFile(filePath: string): Promise<ClassificationEntry> {
  let rawContent: string;
  try {
    rawContent = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    return {
      skillName: path.basename(path.dirname(filePath)),
      filePath,
      executionType: 'unknown',
      allowedTools: [],
      source: 'default',
      status: 'unclassified',
      error: `Cannot read file: ${(err as Error).message}`,
    };
  }

  try {
    const frontmatter = parseFrontmatter(rawContent.replace(/^\uFEFF/, ''));

    let executionType: string;
    let source: ClassificationEntry['source'];

    if (frontmatter.execution?.type) {
      // Author declared execution type explicitly.
      executionType = frontmatter.execution.type;
      // Determine format.
      source = hasExecutionBlock(rawContent) ? 'execution:' : 'metadata:';
    } else if (frontmatter.allowedTools.length > 0) {
      // Try to classify using the first allowed tool against taxonomy.
      const firstTool = frontmatter.allowedTools[0];
      const result = classify(firstTool, {});
      executionType = result.config.type;
      source = result.source === 'taxonomy' ? 'taxonomy' : 'default';
    } else {
      executionType = 'side_effect_mutation';
      source = 'default';
    }

    const status = getStatus(source);

    return {
      skillName: frontmatter.name,
      filePath,
      executionType,
      allowedTools: frontmatter.allowedTools,
      source,
      status,
    };
  } catch (err) {
    return {
      skillName: path.basename(path.dirname(filePath)),
      filePath,
      executionType: 'unknown',
      allowedTools: [],
      source: 'default',
      status: 'unclassified',
      error: `Parse error: ${(err as Error).message}`,
    };
  }
}

function hasExecutionBlock(rawContent: string): boolean {
  return /^execution:/m.test(rawContent);
}

function getStatus(source: ClassificationEntry['source']): ClassificationEntry['status'] {
  if (source === 'execution:' || source === 'metadata:') return 'tenured';
  if (source === 'taxonomy') return 'classified';
  return 'unclassified';
}

/**
 * Print the classification table to stdout.
 */
function printReport(report: ClassificationReport): void {
  const COL_SKILL = 28;
  const COL_TYPE = 26;
  const COL_SOURCE = 12;

  const header = [
    'Skill'.padEnd(COL_SKILL),
    'Type'.padEnd(COL_TYPE),
    'Source'.padEnd(COL_SOURCE),
    'Status',
  ].join('  ');

  const divider = '─'.repeat(header.length);

  console.log(`\n  ${header}`);
  console.log(`  ${divider}`);

  for (const entry of report.entries) {
    if (entry.error) {
      console.log(`  ${entry.skillName.slice(0, COL_SKILL - 1).padEnd(COL_SKILL)}  ${'ERROR'.padEnd(COL_TYPE)}  ${entry.error}`);
      continue;
    }

    const row = [
      entry.skillName.slice(0, COL_SKILL - 1).padEnd(COL_SKILL),
      entry.executionType.padEnd(COL_TYPE),
      entry.source.padEnd(COL_SOURCE),
      entry.status,
    ].join('  ');

    console.log(`  ${row}`);
  }

  console.log(`\n  ${report.total} skills scanned · ${report.tenured} tenured · ${report.classified} classified · ${report.unclassified} unclassified`);
}
