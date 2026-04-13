import { classify, lookupTaxonomy, taxonomySize, resolveBridge, bridgeVersion, bridgeSize } from '../src/router';
import type { ExecutionType } from '../src/router';

/**
 * Router behavior test — verifies the user-facing contract of classify().
 *
 * No test framework: exits 0 on all-pass, 1 on any failure.
 * Each assertion tests behavior that a caller depends on, not implementation details.
 */

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(label: string, actual: unknown, expected: unknown): void {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    failures.push(`  FAIL: ${label}\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`);
  }
}

function assertType(toolName: string, expectedType: ExecutionType, params: Record<string, unknown> = {}): void {
  const result = classify(toolName, params);
  assert(`classify("${toolName}") → ${expectedType}`, result.config.type, expectedType);
}

function assertSource(toolName: string, expectedSource: 'taxonomy' | 'conditional' | 'bridge' | 'default', params: Record<string, unknown> = {}): void {
  const result = classify(toolName, params);
  assert(`classify("${toolName}") source → ${expectedSource}`, result.source, expectedSource);
}

console.log('\n=== Tenure SER Router — Behavior Test ===\n');

// ── Taxonomy size ─────────────────────────────────────────────────────────────
console.log('[1] Taxonomy load');
assert('taxonomy has 51 entries', taxonomySize(), 51);
assert('lookupTaxonomy("stripe") not null', lookupTaxonomy('stripe') !== null, true);
assert('lookupTaxonomy("UNKNOWN_TOOL_XYZ") is null', lookupTaxonomy('UNKNOWN_TOOL_XYZ'), null);

// ── All 50 taxonomy entries classify correctly ────────────────────────────────
console.log('[2] Taxonomy entries — expected execution types');

// Idempotent reads
assertType('sequential-thinking', 'idempotent_read');
assertType('file-read', 'idempotent_read');
assertType('web-search', 'idempotent_read');
assertType('web-fetch', 'idempotent_read');
assertType('grep', 'idempotent_read');
assertType('glob', 'idempotent_read');
assertType('exa-search', 'idempotent_read');
assertType('context7', 'idempotent_read');
assertType('lsp', 'idempotent_read');
assertType('sentry', 'idempotent_read');
assertType('grafana', 'idempotent_read');
assertType('vector-search', 'idempotent_read');
assertType('pdf-search', 'idempotent_read');
assertType('markdownify', 'idempotent_read');
assertType('obsidian', 'idempotent_read');
assertType('firecrawl', 'idempotent_read');

// Side-effect mutations
assertType('shell', 'side_effect_mutation');
assertType('file-write', 'side_effect_mutation');
assertType('file-edit', 'side_effect_mutation');
assertType('github-api', 'side_effect_mutation');
assertType('git', 'side_effect_mutation');
assertType('memory', 'side_effect_mutation');
assertType('python-repl', 'side_effect_mutation');
assertType('desktop-commander', 'side_effect_mutation');
assertType('docker', 'side_effect_mutation');
assertType('slack', 'side_effect_mutation');
assertType('message', 'side_effect_mutation');
assertType('task-manager', 'side_effect_mutation');
assertType('cloudflare', 'side_effect_mutation');
assertType('aws', 'side_effect_mutation');
assertType('pagerduty', 'side_effect_mutation');
assertType('dalle', 'side_effect_mutation');
assertType('composio', 'side_effect_mutation');
assertType('e2b', 'side_effect_mutation');

// Stateful sessions
assertType('playwright', 'stateful_session');
assertType('puppeteer', 'stateful_session');

// Critical transactions
assertType('stripe', 'critical_transaction');
assertType('terraform', 'critical_transaction');
assertType('kubernetes', 'critical_transaction');
assertType('vercel', 'critical_transaction');

// Long-running
assertType('subagent', 'long_running_process');
assertType('cron', 'long_running_process');

// DB defaults (read path — no SQL write keyword)
assertType('postgresql', 'idempotent_read');
assertType('mysql', 'idempotent_read');
assertType('sqlite', 'idempotent_read');
assertType('mongodb', 'idempotent_read');
assertType('notion', 'idempotent_read');
assertType('jira', 'idempotent_read');
assertType('linear', 'idempotent_read');
assertType('google-workspace', 'idempotent_read');

// Remaining
assertType('clawhub', 'side_effect_mutation');

// ── Alias resolution ──────────────────────────────────────────────────────────
console.log('[3] Alias resolution');
assertType('brave_search', 'idempotent_read');         // alias for web-search
assertType('tavily', 'idempotent_read');               // alias for web-search
assertType('ripgrep', 'idempotent_read');              // alias for grep
assertType('rg', 'idempotent_read');                   // alias for grep
assertType('postgres', 'idempotent_read');             // alias for postgresql
assertType('psql', 'idempotent_read');                 // alias for postgresql
assertType('mem0', 'side_effect_mutation');            // alias for memory
assertType('qdrant', 'idempotent_read');               // alias for vector-search
assertType('chroma', 'idempotent_read');               // alias for vector-search
assertType('s3', 'side_effect_mutation');              // alias for aws
assertType('gh', 'side_effect_mutation');              // alias for github-api
assertType('STRIPE', 'critical_transaction');          // case-insensitive
assertType('Web_Search', 'idempotent_read');           // underscore + case normalization

// ── Conditional overrides ─────────────────────────────────────────────────────
console.log('[4] Conditional overrides');

// Git: read commands → idempotent_read
assertType('git', 'idempotent_read', { command: 'status' });
assertType('git', 'idempotent_read', { command: 'log --oneline -10' });
assertType('git', 'idempotent_read', { command: 'diff HEAD' });
assertType('git', 'idempotent_read', { command: 'show HEAD' });
assertSource('git', 'conditional', { command: 'status' });

// Git: push --force → critical_transaction
assertType('git', 'critical_transaction', { command: 'push --force origin main' });
assertType('git', 'critical_transaction', { command: 'push -f origin main' });
assertSource('git', 'conditional', { command: 'push --force origin main' });

// Git: regular commit → taxonomy (side_effect_mutation)
assertType('git', 'side_effect_mutation', { command: 'commit -m "fix"' });
assertSource('git', 'taxonomy', { command: 'commit -m "fix"' });

// PostgreSQL: SELECT → idempotent_read (default)
assertType('postgresql', 'idempotent_read', { query: 'SELECT * FROM users' });
assertSource('postgresql', 'taxonomy', { query: 'SELECT * FROM users' });

// PostgreSQL: INSERT → side_effect_mutation
assertType('postgresql', 'side_effect_mutation', { query: 'INSERT INTO logs VALUES (1, "x")' });
assertSource('postgresql', 'conditional', { query: 'INSERT INTO logs VALUES (1, "x")' });

// PostgreSQL: DROP → side_effect_mutation (from conditional, not critical — router conservative)
assertType('postgresql', 'side_effect_mutation', { query: 'DROP TABLE sessions' });
assertType('postgres', 'side_effect_mutation', { query: 'UPDATE users SET active = false' });
assertType('mysql', 'side_effect_mutation', { query: 'DELETE FROM tokens WHERE expired = 1' });
assertType('sqlite', 'side_effect_mutation', { query: 'ALTER TABLE config ADD COLUMN v TEXT' });
assertType('mongodb', 'side_effect_mutation', { query: 'DELETE FROM old_data' });

// GitHub: regular PR creation → taxonomy (side_effect_mutation)
assertType('github-api', 'side_effect_mutation', { action: 'create', title: 'Fix bug' });
assertSource('github-api', 'taxonomy', { action: 'create', title: 'Fix bug' });

// GitHub: merge to main → critical_transaction
assertType('github-api', 'critical_transaction', { action: 'merge', base: 'main' });
assertType('gh', 'critical_transaction', { action: 'merge', base: 'production' });
assertSource('github-api', 'conditional', { action: 'merge', base: 'main' });

// GitHub: merge to feature branch → not critical (no conditional override)
assertType('github-api', 'side_effect_mutation', { action: 'merge', base: 'feature/xyz' });

// Slack: normal send → side_effect_mutation
assertType('slack', 'side_effect_mutation', { message: 'hello' });
assertSource('slack', 'taxonomy', { message: 'hello' });

// Message tool: generic messaging defaults to side_effect_mutation
assertType('message', 'side_effect_mutation', { channel: 'discord', text: 'hello' });
assertSource('message', 'taxonomy', { channel: 'discord', text: 'hello' });

// Slack: waitForReply → human_interactive
assertType('slack', 'human_interactive', { message: 'hello', waitForReply: true });
assertSource('slack', 'conditional', { message: 'hello', waitForReply: true });

// AWS: create resource → taxonomy (side_effect_mutation)
assertType('aws', 'side_effect_mutation', { action: 'CreateBucket', bucket: 'my-bucket' });
assertSource('aws', 'taxonomy', { action: 'CreateBucket', bucket: 'my-bucket' });

// AWS: destructive action → critical_transaction
assertType('aws', 'critical_transaction', { action: 'DeleteBucket', bucket: 'my-bucket' });
assertType('aws', 'critical_transaction', { action: 'TerminateInstances', instanceIds: ['i-123'] });
assertSource('aws', 'conditional', { action: 'DeleteBucket' });

// Google Workspace: read → idempotent_read
assertType('google-workspace', 'idempotent_read', { action: 'readCalendar' });
assertSource('google-workspace', 'taxonomy', { action: 'readCalendar' });

// Google Workspace: send email → side_effect_mutation
assertType('SendEmail', 'side_effect_mutation', { to: 'user@example.com' });
assertSource('SendEmail', 'conditional', { to: 'user@example.com' });

// ── Stateful session has heartbeat config ─────────────────────────────────────
console.log('[5] Stateful session config');
const playwrightResult = classify('playwright');
assert('playwright has heartbeatIntervalMs', playwrightResult.config.heartbeatIntervalMs !== undefined, true);
assert('playwright heartbeat is 30000ms', playwrightResult.config.heartbeatIntervalMs, 30000);
assert('playwright type is stateful_session', playwrightResult.config.type, 'stateful_session');

// ── Critical transaction config ───────────────────────────────────────────────
console.log('[6] Critical transaction config');
const stripeResult = classify('stripe', { idempotencyKey: 'pay_abc' });
assert('stripe hitl is required', stripeResult.config.hitl, 'required');
assert('stripe maximumAttempts is 1', stripeResult.config.retryPolicy.maximumAttempts, 1);
assert('stripe cache is false', stripeResult.config.cache, false);
assert('stripe source is taxonomy', stripeResult.source, 'taxonomy');

const terraformResult = classify('terraform');
assert('terraform hitl is required', terraformResult.config.hitl, 'required');
assert('terraform maximumAttempts is 1', terraformResult.config.retryPolicy.maximumAttempts, 1);

// ── Safe default for unknown tools ────────────────────────────────────────────
console.log('[7] Safe default for unknown tools');
const unknownResult = classify('my-custom-unknown-tool-xyz');
assert('unknown tool source is default', unknownResult.source, 'default');
assert('unknown tool type is side_effect_mutation', unknownResult.config.type, 'side_effect_mutation');
assert('unknown tool maximumAttempts is 1', unknownResult.config.retryPolicy.maximumAttempts, 1);
assert('unknown tool cache is false', unknownResult.config.cache, false);
assert('unknown tool idempotent is false', unknownResult.config.idempotent, false);

// Another unknown
const unknown2 = classify('highly-custom-enterprise-tool');
assert('second unknown source is default', unknown2.source, 'default');
assert('second unknown type is side_effect_mutation', unknown2.config.type, 'side_effect_mutation');

// ── Bridge resolution ─────────────────────────────────────────────────────────
console.log('[8] Bridge resolution');

assert('bridge loads with 120+ skills', bridgeSize() >= 120, true);
assert('bridge version is 0.2.0', bridgeVersion(), '0.2.0');

assert('resolveBridge("wacli") returns ["exec"]', JSON.stringify(resolveBridge('wacli')), JSON.stringify(['exec']));
assert('resolveBridge("weather") returns ["web_fetch","web_search"]', JSON.stringify(resolveBridge('weather')), JSON.stringify(['web_fetch', 'web_search']));
assert('resolveBridge("1password") returns ["exec"]', JSON.stringify(resolveBridge('1password')), JSON.stringify(['exec']));
assert('resolveBridge("unknown-xyz") returns null', resolveBridge('unknown-xyz-999'), null);

// Bridge-resolved classify: wacli → exec → shell taxonomy entry (side_effect_mutation)
const wacliResult = classify('wacli');
assert('classify("wacli") source is bridge', wacliResult.source, 'bridge');
assert('classify("wacli") type is side_effect_mutation', wacliResult.config.type, 'side_effect_mutation');
assert('classify("wacli") reason mentions bridge', wacliResult.reason.includes('bridge v'), true);

// Bridge-resolved classify: weather → web_fetch + web_search (both idempotent_read)
const weatherResult = classify('weather');
assert('classify("weather") source is bridge', weatherResult.source, 'bridge');
assert('classify("weather") type is idempotent_read', weatherResult.config.type, 'idempotent_read');

// Bridge-resolved classify: 1password → exec → side_effect_mutation
const onePassResult = classify('1password');
assert('classify("1password") source is bridge', onePassResult.source, 'bridge');
assert('classify("1password") type is side_effect_mutation', onePassResult.config.type, 'side_effect_mutation');

// v0.2 bridge entries: CLI wrappers → shell (side_effect_mutation)
assertType('apple-notes', 'side_effect_mutation');
assertSource('apple-notes', 'bridge');
assertType('tmux', 'side_effect_mutation');
assertSource('tmux', 'bridge');
assertType('xurl', 'side_effect_mutation');
assertSource('xurl', 'bridge');

// v0.2 bridge entries: API callers → web-fetch (idempotent_read)
assertType('bluebubbles', 'idempotent_read');
assertSource('bluebubbles', 'bridge');
assertType('discord', 'idempotent_read');
assertSource('discord', 'bridge');

// v0.2 bridge: gh-issues → github-api + shell → side_effect_mutation (highest risk)
assertType('gh-issues', 'side_effect_mutation');
assertSource('gh-issues', 'bridge');

// v0.2 bridge: orchestration → subagent (long_running_process)
assertType('taskflow', 'long_running_process');
assertSource('taskflow', 'bridge');

// v0.2 bridge: skill-creator → file-edit (side_effect_mutation)
assertType('skill-creator', 'side_effect_mutation');
assertSource('skill-creator', 'bridge');

// Tool already in taxonomy should still resolve via taxonomy, not bridge
assertSource('shell', 'taxonomy');
assertSource('web-search', 'taxonomy');
assertSource('stripe', 'taxonomy');

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(f);
}

console.log(`\n${failed === 0 ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
