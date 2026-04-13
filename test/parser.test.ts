import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { parse, parseString } from '../src/parser/index';
import { parseFrontmatter } from '../src/parser/frontmatter';

/**
 * Parser tests — user-facing behavior validation.
 *
 * Tests verify that:
 * 1. All 5 sample fixtures parse without errors
 * 2. Step counts and types are correct for each fixture
 * 3. Parsing is deterministic (same file → same SkillPlan)
 * 4. Both frontmatter formats produce equivalent ExecutionBlock
 * 5. Unknown tools fall back to side_effect_mutation
 * 6. Thinking step identification works correctly
 */

const FIXTURES_DIR = path.join(__dirname, 'fixtures/sample-skills');

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function fixturePath(skillDir: string): string {
  return path.join(FIXTURES_DIR, skillDir, 'SKILL.md');
}

// ─── 1. All 5 fixtures parse without errors ──────────────────────────────────

describe('parser: fixture parsing', () => {
  it('parses cron-log-skill', async () => {
    const plan = await parse(fixturePath('cron-log-skill'));
    expect(plan.name).toBe('cron-log-writer');
    expect(plan.description).toContain('cron durability');
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.version).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    expect(plan.allowedTools).toContain('write');
  });

  it('parses web-search-skill', async () => {
    const plan = await parse(fixturePath('web-search-skill'));
    expect(plan.name).toBe('web-search');
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.allowedTools).toContain('web_search');
  });

  it('parses deploy-skill', async () => {
    const plan = await parse(fixturePath('deploy-skill'));
    expect(plan.name).toBe('deploy-service');
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.execution?.type).toBe('critical_transaction');
    expect(plan.execution?.hitl).toBe('required');
  });

  it('parses data-pipeline-skill (metadata: tenure.* format)', async () => {
    const plan = await parse(fixturePath('data-pipeline-skill'));
    expect(plan.name).toBe('data-pipeline');
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.execution?.type).toBe('side_effect_mutation');
  });

  it('parses browser-automation-skill', async () => {
    const plan = await parse(fixturePath('browser-automation-skill'));
    expect(plan.name).toBe('browser-automation');
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.execution?.type).toBe('stateful_session');
    expect(plan.execution?.heartbeatInterval).toBe(30);
  });
});

// ─── 2. Determinism ──────────────────────────────────────────────────────────

describe('parser: determinism', () => {
  it('produces identical SkillPlan on repeated parsing of the same file', async () => {
    const path1 = fixturePath('cron-log-skill');
    const plan1 = await parse(path1);
    const plan2 = await parse(path1);
    expect(plan1).toEqual(plan2);
  });

  it('same content string always produces the same version hash', () => {
    const content = `---
name: test-skill
description: A test skill.
---
# Test

1. Read the file using read_file
`;
    const plan1 = parseString(content);
    const plan2 = parseString(content);
    expect(plan1.version).toBe(plan2.version);
    expect(plan1.steps).toEqual(plan2.steps);
  });

  it('different content produces different version hashes', () => {
    const base = `---
name: skill-a
description: Skill A.
---
1. Read the file
`;
    const modified = base.replace('Skill A', 'Skill B');
    const plan1 = parseString(base);
    const plan2 = parseString(modified);
    expect(plan1.version).not.toBe(plan2.version);
  });
});

// ─── 3. Frontmatter format parity ────────────────────────────────────────────

describe('parser: frontmatter format parity', () => {
  const executionBlock = `---
name: test-skill
description: Test skill.
allowed-tools:
  - write_file
execution:
  type: side_effect_mutation
  retry: 3
  hitl: none
---
1. Write the data using write_file
`;

  const metadataBlock = `---
name: test-skill
description: Test skill.
allowed-tools:
  - write_file
metadata:
  tenure.execution_type: side_effect_mutation
  tenure.retry: "3"
  tenure.hitl: none
---
1. Write the data using write_file
`;

  it('execution: block produces ExecutionBlock with type', () => {
    const plan = parseString(executionBlock);
    expect(plan.execution?.type).toBe('side_effect_mutation');
    expect(plan.execution?.retry).toBe(3);
    expect(plan.execution?.hitl).toBe('none');
  });

  it('metadata: tenure.* block produces equivalent ExecutionBlock', () => {
    const plan = parseString(metadataBlock);
    expect(plan.execution?.type).toBe('side_effect_mutation');
    expect(plan.execution?.retry).toBe(3);
    expect(plan.execution?.hitl).toBe('none');
  });

  it('both formats produce steps with same tool classification', () => {
    const planExec = parseString(executionBlock);
    const planMeta = parseString(metadataBlock);
    expect(planExec.steps.length).toBe(planMeta.steps.length);
    expect(planExec.steps[0].type).toBe(planMeta.steps[0].type);
    expect(planExec.steps[0].toolName).toBe(planMeta.steps[0].toolName);
  });
});

// ─── 4. Step type identification ─────────────────────────────────────────────

describe('parser: step type identification', () => {
  it('identifies tool_call steps for known allowed-tools', () => {
    const content = `---
name: file-writer
description: Writes files.
allowed-tools:
  - write_file
  - read_file
---
1. Read the source using read_file
2. Write the result using write_file
`;
    const plan = parseString(content);
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].type).toBe('tool_call');
    expect(plan.steps[1].type).toBe('tool_call');
  });

  it('identifies thinking steps when no tool reference is present', () => {
    const content = `---
name: reasoning-skill
description: Does reasoning.
allowed-tools:
  - write_file
---
1. Decide which approach is better based on the constraints
2. Choose between option A and option B by comparing their trade-offs
3. Write the decision using write_file
`;
    const plan = parseString(content);
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0].type).toBe('thinking');
    expect(plan.steps[1].type).toBe('thinking');
    expect(plan.steps[2].type).toBe('tool_call');
  });

  it('deploy-skill has both tool_call and thinking steps', async () => {
    const plan = await parse(fixturePath('deploy-skill'));
    const toolCallSteps = plan.steps.filter(s => s.type === 'tool_call');
    const thinkingSteps = plan.steps.filter(s => s.type === 'thinking');
    // "Decide the rollout strategy" is a thinking step
    expect(thinkingSteps.length).toBeGreaterThan(0);
    expect(toolCallSteps.length).toBeGreaterThan(0);
  });

  it('thinking steps have correct defaults when no execution block', () => {
    const content = `---
name: pure-reasoning
description: Pure reasoning skill.
---
1. Decide which option is better based on the cost-benefit analysis
2. Evaluate the trade-offs between reliability and performance
`;
    const plan = parseString(content);
    expect(plan.steps).toHaveLength(2);
    plan.steps.forEach(step => {
      expect(step.type).toBe('thinking');
      expect(step.modelTier).toBe('mid'); // default
      expect(step.tokenBudget).toBe(0);   // no limit
    });
  });

  it('thinking steps inherit modelTier from execution block', () => {
    const content = `---
name: frontier-skill
description: Uses frontier model.
execution:
  model_tier: frontier
  token_budget: 8000
---
1. Reason through this complex problem
`;
    const plan = parseString(content);
    expect(plan.steps[0].type).toBe('thinking');
    expect(plan.steps[0].modelTier).toBe('frontier');
    expect(plan.steps[0].tokenBudget).toBe(8000);
  });
});

// ─── 5. Unknown tool fallback ─────────────────────────────────────────────────

describe('parser: unknown tool fallback', () => {
  it('unknown tools not in taxonomy get side_effect_mutation default from router', () => {
    const content = `---
name: mystery-skill
description: Uses an unknown tool.
allowed-tools:
  - completely_unknown_tool_xyz
---
1. Use completely_unknown_tool_xyz to do something
`;
    const plan = parseString(content);
    expect(plan.steps).toHaveLength(1);
    // The router returns side_effect_mutation as safe default for unknown tools
    const step = plan.steps[0];
    expect(step.type).toBe('tool_call');
    expect(step.toolName).toBe('completely_unknown_tool_xyz');
    expect(step.executionConfig?.type).toBe('side_effect_mutation');
  });
});

// ─── 6. Frontmatter validation ────────────────────────────────────────────────

describe('parser: frontmatter validation', () => {
  it('throws if name is missing', () => {
    const content = `---
description: No name here.
---
1. Do something
`;
    expect(() => parseString(content)).toThrow("name");
  });

  it('throws if description is missing', () => {
    const content = `---
name: no-description
---
1. Do something
`;
    expect(() => parseString(content)).toThrow("description");
  });

  it('parses allowed-tools as array from YAML list', () => {
    const content = `---
name: test
description: Test.
allowed-tools:
  - tool_a
  - tool_b
  - tool_c
---
1. Do something with tool_a
`;
    const plan = parseString(content);
    expect(plan.allowedTools).toEqual(['tool_a', 'tool_b', 'tool_c']);
  });
});
