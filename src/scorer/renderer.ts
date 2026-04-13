import type { ScoreResult, BatchSummary, CategoryScore, Finding, Recommendation } from './types';

/**
 * Renderer — CLI output for the Skill Durability Score.
 *
 * Why it exists: the score is useless if it's hard to read. The renderer
 * produces a visually distinctive box with score bar, per-category breakdown,
 * findings, and actionable recommendations.
 *
 * Two modes:
 * - Single: full scorecard for one skill
 * - Batch: summary table across many skills with aggregate stats
 */

const BAR_WIDTH = 25;

/** Render a single skill's full scorecard to stdout. */
export function renderScore(result: ScoreResult): void {
  const bar = makeBar(result.totalScore, 100);
  const statusSymbol = result.status === 'DURABLE' ? 'DURABLE' :
    result.status === 'PARTIALLY DURABLE' ? 'PARTIALLY DURABLE' : 'FRAGILE';

  console.log('');
  console.log('  ' + boxTop(49));
  console.log('  ' + boxLine('SKILL DURABILITY SCORE', 49));
  console.log('  ' + boxLine('', 49));
  console.log('  ' + boxLine(`${padRight(result.skillName, 30)} ${padLeft(`${result.totalScore} / 100`, 12)}`, 49));
  console.log('  ' + boxLine(bar, 49));
  console.log('  ' + boxLine('', 49));

  for (const cat of result.categories) {
    const icon = cat.category === 'perfBaseline' ? '.' : (cat.passed ? '+' : '-');
    const suffix = cat.category === 'perfBaseline' ? '  (needs runs)' : '';
    const line = `${icon}  ${padRight(cat.label, 22)} ${padLeft(`${cat.points}/${cat.maxPoints}`, 6)}${suffix}`;
    console.log('  ' + boxLine(line, 49));
  }

  console.log('  ' + boxLine('', 49));
  console.log('  ' + boxLine(`Status: ${statusSymbol}`, 49));
  console.log('  ' + boxBottom(49));

  // Findings
  const negativeFindings = result.findings.filter(f => f.points < 0 || (f.points === 0 && f.message.includes('without') || f.message.includes('SAFE_DEFAULT') || f.message.includes('confidence <')));
  if (negativeFindings.length > 0) {
    console.log('\n  Findings:');
    for (const f of negativeFindings.slice(0, 8)) {
      const prefix = f.points < 0 ? `(${f.points})` : '     ';
      console.log(`    ${prefix} ${f.message}`);
    }
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    console.log('\n  Recommendations:');
    for (const r of result.recommendations.slice(0, 5)) {
      console.log(`    + ${r.message} (+${r.potentialPoints} pts)`);
    }
  }

  console.log('');
}

/** Render a batch summary table to stdout. */
export function renderBatchSummary(summary: BatchSummary): void {
  const COL_SKILL = 28;
  const COL_SCORE = 10;

  console.log('');
  const header = `${padRight('Skill', COL_SKILL)}  ${padRight('Score', COL_SCORE)}  Status`;
  console.log(`  ${header}`);
  console.log(`  ${'─'.repeat(header.length)}`);

  const sorted = [...summary.results].sort((a, b) => b.totalScore - a.totalScore);

  for (const r of sorted) {
    const name = r.skillName.length > COL_SKILL - 1 ? r.skillName.slice(0, COL_SKILL - 2) + '..' : r.skillName;
    const score = `${r.totalScore}/100`;
    console.log(`  ${padRight(name, COL_SKILL)}  ${padRight(score, COL_SCORE)}  ${r.status}`);
  }

  console.log('');
  console.log(`  Summary: ${summary.totalSkills} skills | avg ${summary.averageScore}/100 | ${summary.durableCount} DURABLE | ${summary.partiallyDurableCount} PARTIAL | ${summary.fragileCount} FRAGILE`);

  if (summary.topFinding) {
    console.log(`\n  Top finding: ${summary.topFinding}`);
  }

  console.log('');
}

// ─── Box drawing helpers ─────────────────────────────────────────────────────

function boxTop(width: number): string {
  return '┌' + '─'.repeat(width) + '┐';
}

function boxBottom(width: number): string {
  return '└' + '─'.repeat(width) + '┘';
}

function boxLine(content: string, width: number): string {
  const visible = stripAnsi(content);
  const padding = Math.max(0, width - visible.length - 2);
  return '│ ' + content + ' '.repeat(padding) + ' │';
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function makeBar(value: number, max: number): string {
  const filled = Math.round((value / max) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function padRight(s: string, width: number): string {
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length);
}

function padLeft(s: string, width: number): string {
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}
