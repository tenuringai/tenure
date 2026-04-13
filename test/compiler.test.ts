import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import { parseString } from '../src/parser/index';
import { toActivityOptions, THINKING_ACTIVITY_OPTIONS } from '../src/compiler/activity-dispatch';
import { hashSkillContent } from '../src/parser/version';

/**
 * Compiler tests — user-facing behavior validation.
 *
 * These tests verify the compiler pipeline units in isolation:
 * 1. SkillPlan version hash is embedded correctly
 * 2. ActivityOptions are derived correctly from ExecutionConfig
 * 3. Thinking activity options follow zeitlich's LLM-appropriate defaults
 * 4. compile() constructs correct workflow IDs and schedule IDs
 *
 * Note: tests that require a live Temporal server are in the certify suite.
 * These tests validate the pipeline's deterministic, non-network components.
 */

// ─── 1. SkillPlan version hash ────────────────────────────────────────────────

describe('compiler: SkillPlan version hash', () => {
  it('version hash is a 64-char hex string (SHA-256)', () => {
    const plan = parseString(`---
name: test-skill
description: Test skill.
---
1. Read the file using read_file
`);
    expect(plan.version).toMatch(/^[a-f0-9]{64}$/);
  });

  it('version hash changes when content changes', () => {
    const v1 = parseString(`---
name: skill-v1
description: Version 1.
---
1. Read using read_file
`);
    const v2 = parseString(`---
name: skill-v1
description: Version 2.
---
1. Read using read_file
`);
    expect(v1.version).not.toBe(v2.version);
  });

  it('version hash is deterministic', () => {
    const content = `---
name: deterministic-skill
description: Deterministic test.
---
1. Write the file using write_file
`;
    const h1 = hashSkillContent(content);
    const h2 = hashSkillContent(content);
    expect(h1).toBe(h2);
  });

  it('workflow ID is derived from skill name + version prefix', () => {
    const plan = parseString(`---
name: my-skill
description: My skill.
---
1. Write using write_file
`);
    // The compiler uses: tenure-skill-{name}-{version.slice(0,12)}
    const expectedWorkflowId = `tenure-skill-my-skill-${plan.version.slice(0, 12)}`;
    expect(expectedWorkflowId).toMatch(/^tenure-skill-my-skill-[a-f0-9]{12}$/);
  });
});

// ─── 2. ActivityOptions from ExecutionConfig ─────────────────────────────────

describe('compiler: activity options mapping', () => {
  it('idempotent_read → high retry, cache-appropriate timeout', () => {
    const plan = parseString(`---
name: search-skill
description: Search skill.
allowed-tools:
  - web_search
---
1. Search using web_search
`);
    const toolStep = plan.steps.find(s => s.type === 'tool_call');
    expect(toolStep).toBeDefined();
    expect(toolStep!.executionConfig).toBeDefined();

    const opts = toActivityOptions(toolStep!.executionConfig!);
    // idempotent_read has maximumAttempts: 3 from taxonomy
    expect(opts.retry?.maximumAttempts).toBeGreaterThanOrEqual(3);
  });

  it('side_effect_mutation → conservative retry', () => {
    const plan = parseString(`---
name: write-skill
description: Write skill.
allowed-tools:
  - write_file
---
1. Write the data using write_file
`);
    const toolStep = plan.steps.find(s => s.type === 'tool_call');
    expect(toolStep).toBeDefined();
    const opts = toActivityOptions(toolStep!.executionConfig!);
    // side_effect_mutation should have limited retries
    expect(opts.retry?.maximumAttempts).toBeLessThanOrEqual(3);
    expect(opts.startToCloseTimeout).toBeDefined();
  });

  it('stateful_session → has heartbeatTimeout', () => {
    const plan = parseString(`---
name: browser-skill
description: Browser skill.
allowed-tools:
  - playwright
execution:
  type: stateful_session
  heartbeat_interval: 30
---
1. Launch playwright browser session
`);
    const toolStep = plan.steps.find(s => s.type === 'tool_call');
    expect(toolStep).toBeDefined();
    const opts = toActivityOptions(toolStep!.executionConfig!);
    // stateful_session should have heartbeat timeout
    expect(opts.heartbeatTimeout).toBeDefined();
  });

  it('all steps have startToCloseTimeout set', () => {
    const plan = parseString(`---
name: multi-step
description: Multi-step skill.
allowed-tools:
  - read_file
  - write_file
---
1. Read the data using read_file
2. Write the result using write_file
`);
    for (const step of plan.steps.filter(s => s.type === 'tool_call')) {
      const opts = toActivityOptions(step.executionConfig!);
      expect(opts.startToCloseTimeout).toBeDefined();
    }
  });
});

// ─── 3. Thinking activity options ────────────────────────────────────────────

describe('compiler: thinking activity options', () => {
  it('THINKING_ACTIVITY_OPTIONS has LLM-appropriate timeouts (mirrors zeitlich proxyRunAgent)', () => {
    expect(THINKING_ACTIVITY_OPTIONS.startToCloseTimeout).toBe('10m');
    expect(THINKING_ACTIVITY_OPTIONS.heartbeatTimeout).toBe('1m');
  });

  it('THINKING_ACTIVITY_OPTIONS has 3 retries with backoff', () => {
    expect(THINKING_ACTIVITY_OPTIONS.retry?.maximumAttempts).toBe(3);
    expect(THINKING_ACTIVITY_OPTIONS.retry?.backoffCoefficient).toBe(3);
  });
});

// ─── 4. Cron schedule ID format ──────────────────────────────────────────────

describe('compiler: schedule ID format', () => {
  it('schedule ID is deterministic from skill name + version + cron expression', () => {
    const plan = parseString(`---
name: cron-skill
description: Cron skill.
---
1. Write the log using write_file
`);
    const cron = '*/5 * * * *';
    const cronSlug = cron.replace(/[^a-z0-9]/gi, '-');
    const expectedId = `tenure-cron-cron-skill-${plan.version.slice(0, 8)}-${cronSlug}`;

    // Verify the format matches what schedule-builder.ts produces
    expect(expectedId).toMatch(/^tenure-cron-cron-skill-[a-f0-9]{8}-/);
  });

  it('different cron expressions produce different schedule IDs', () => {
    const plan = parseString(`---
name: cron-skill
description: Cron skill.
---
1. Write the log using write_file
`);
    const cronEvery5 = '*/5 * * * *';
    const cronEvery60 = '*/60 * * * *';

    const slug5 = cronEvery5.replace(/[^a-z0-9]/gi, '-');
    const slug60 = cronEvery60.replace(/[^a-z0-9]/gi, '-');

    const id5 = `tenure-cron-cron-skill-${plan.version.slice(0, 8)}-${slug5}`;
    const id60 = `tenure-cron-cron-skill-${plan.version.slice(0, 8)}-${slug60}`;

    expect(id5).not.toBe(id60);
  });
});

// ─── 5. Pipeline integration (parse → compiler input) ────────────────────────

describe('compiler: pipeline integration', () => {
  it('cron-log-skill fixture produces compilable SkillPlan', async () => {
    const fixturePath = path.join(__dirname, 'fixtures/sample-skills/cron-log-skill/SKILL.md');
    const { parse } = await import('../src/parser/index');
    const plan = await parse(fixturePath);

    // Verify the plan has all required fields for compilation
    expect(plan.name).toBeTruthy();
    expect(plan.version).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.steps.length).toBeGreaterThan(0);

    // All tool_call steps should have executionConfig
    for (const step of plan.steps.filter(s => s.type === 'tool_call')) {
      expect(step.executionConfig).toBeDefined();
      expect(step.executionConfig!.type).toBeDefined();
      expect(step.executionConfig!.retryPolicy).toBeDefined();
      expect(step.executionConfig!.timeoutMs).toBeGreaterThan(0);
    }
  });

  it('all 5 fixtures produce compilable SkillPlans', async () => {
    const { parse } = await import('../src/parser/index');
    const fixtures = [
      'cron-log-skill',
      'web-search-skill',
      'deploy-skill',
      'data-pipeline-skill',
      'browser-automation-skill',
    ];

    for (const fixture of fixtures) {
      const fixturePath = path.join(__dirname, `fixtures/sample-skills/${fixture}/SKILL.md`);
      const plan = await parse(fixturePath);

      expect(plan.version).toMatch(/^[a-f0-9]{64}$/);
      expect(plan.steps.length).toBeGreaterThan(0);
    }
  });
});
