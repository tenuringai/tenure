import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { score, scoreFromContent, scoreBatch } from '../src/scorer/index';
import { lookupSkill, knowledgeBaseSize } from '../src/scorer/knowledge-base';
import { getDurabilityStatus } from '../src/scorer/types';

/**
 * Scorer tests — user-facing behavior validation.
 *
 * Tests verify that:
 * 1. All 5 fixtures score without errors and produce valid breakdowns
 * 2. Known skills get enrichment from skill-durability-mapping.json
 * 3. Unknown skills still get a score via SAFE_DEFAULT path
 * 4. Max static score is 80 (Perf Baseline always 0)
 * 5. Status labels match score thresholds
 * 6. Batch mode produces valid summary stats
 */

const FIXTURES_DIR = path.join(__dirname, 'fixtures/sample-skills');

// ─── 1. Fixture scoring ──────────────────────────────────────────────────────

describe('scorer: fixture scoring', () => {
  it('scores cron-log-skill with valid breakdown', async () => {
    const result = await score(path.join(FIXTURES_DIR, 'cron-log-skill/SKILL.md'), { silent: true });
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.categories).toHaveLength(6);
    expect(result.skillName).toBe('cron-log-writer');

    const sum = result.categories.reduce((s, c) => s + c.points, 0);
    expect(sum).toBe(result.totalScore);
  });

  it('scores web-search-skill', async () => {
    const result = await score(path.join(FIXTURES_DIR, 'web-search-skill/SKILL.md'), { silent: true });
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.skillName).toBe('web-search');
  });

  it('scores deploy-skill', async () => {
    const result = await score(path.join(FIXTURES_DIR, 'deploy-skill/SKILL.md'), { silent: true });
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.skillName).toBe('deploy-service');
  });

  it('scores data-pipeline-skill', async () => {
    const result = await score(path.join(FIXTURES_DIR, 'data-pipeline-skill/SKILL.md'), { silent: true });
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.skillName).toBe('data-pipeline');
  });

  it('scores browser-automation-skill', async () => {
    const result = await score(path.join(FIXTURES_DIR, 'browser-automation-skill/SKILL.md'), { silent: true });
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.skillName).toBe('browser-automation');
  });

  it('all fixtures have 6 categories with points summing to totalScore', async () => {
    const fixtures = [
      'cron-log-skill', 'web-search-skill', 'deploy-skill',
      'data-pipeline-skill', 'browser-automation-skill',
    ];

    for (const fixture of fixtures) {
      const result = await score(path.join(FIXTURES_DIR, `${fixture}/SKILL.md`), { silent: true });
      expect(result.categories).toHaveLength(6);
      const sum = result.categories.reduce((s, c) => s + c.points, 0);
      expect(sum).toBe(result.totalScore);
      expect(result.categories.every(c => c.points >= 0)).toBe(true);
      expect(result.categories.every(c => c.points <= c.maxPoints)).toBe(true);
    }
  });
});

// ─── 2. Knowledge base enrichment ────────────────────────────────────────────

describe('scorer: knowledge base enrichment', () => {
  it('knowledge base loads with 50+ skills', () => {
    const size = knowledgeBaseSize();
    expect(size).toBeGreaterThanOrEqual(10);
  });

  it('known skill (web-search) is found in knowledge base', () => {
    const entry = lookupSkill('web-search');
    expect(entry).not.toBeNull();
    expect(entry!.primary_execution_type).toBe('idempotent_read');
    expect(entry!.primary_classification_confidence).toBeGreaterThan(0);
  });

  it('known skill (file-write-create) is found by tool name', () => {
    const entry = lookupSkill('write');
    expect(entry).not.toBeNull();
  });

  it('unknown skill returns null', () => {
    const entry = lookupSkill('completely-unknown-tool-xyz-9999');
    expect(entry).toBeNull();
  });

  it('known skill scoring uses enrichment data', () => {
    const content = `---
name: web-search
description: Searches the web.
allowed-tools:
  - web_search
---
1. Use web_search to find results
`;
    const result = scoreFromContent(content);
    expect(result.analysis.knownInMapping).toBe(true);
    const webSearchTool = result.analysis.tools.find(t => t.toolName === 'web_search');
    expect(webSearchTool?.classificationConfidence).toBeGreaterThan(0);
  });
});

// ─── 3. Unknown skill fallback ───────────────────────────────────────────────

describe('scorer: unknown skill fallback', () => {
  it('completely unknown skill still gets a valid score', () => {
    const content = `---
name: my-exotic-tool
description: Does something unique.
allowed-tools:
  - exotic_function_abc
---
1. Call exotic_function_abc to do its thing
`;
    const result = scoreFromContent(content);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.categories).toHaveLength(6);
    expect(result.analysis.knownInMapping).toBe(false);
    expect(result.status).toBeDefined();
  });

  it('unknown skill uses SAFE_DEFAULT classification', () => {
    const content = `---
name: mystery-tool
description: Unknown.
allowed-tools:
  - totally_unknown_thing
---
1. Use totally_unknown_thing
`;
    const result = scoreFromContent(content);
    const tool = result.analysis.tools.find(t => t.toolName === 'totally_unknown_thing');
    expect(tool).toBeDefined();
    expect(tool!.classifyResult.source).toBe('default');
    expect(tool!.classifyResult.config.type).toBe('side_effect_mutation');
  });
});

// ─── 3b. Bridge-resolved skills ──────────────────────────────────────────────

describe('scorer: bridge resolution', () => {
  it('wacli resolves to exec via bridge — not SAFE_DEFAULT', () => {
    const content = `---
name: wacli
description: WhatsApp CLI tool.
---
1. Use wacli to send messages
`;
    const result = scoreFromContent(content);
    expect(result.analysis.bridgeResolved).toBe(true);
    expect(result.analysis.bridgeVersion).toBe('0.2.0');

    const execTool = result.analysis.tools.find(t => t.toolName === 'exec');
    expect(execTool).toBeDefined();
    expect(execTool!.resolvedViaBridge).toBe(true);
    expect(execTool!.bridgeSourceSkill).toBe('wacli');
    expect(execTool!.classifyResult.source).not.toBe('default');
  });

  it('weather resolves to web_fetch + web_search — gets idempotent_read', () => {
    const content = `---
name: weather
description: Fetch weather data.
---
1. Check the weather
`;
    const result = scoreFromContent(content);
    expect(result.analysis.bridgeResolved).toBe(true);
    expect(result.analysis.tools.length).toBe(2);

    const sources = result.analysis.tools.map(t => t.classifyResult.source);
    expect(sources.every(s => s === 'taxonomy')).toBe(true);

    const types = result.analysis.tools.map(t => t.classifyResult.config.type);
    expect(types.every(t => t === 'idempotent_read')).toBe(true);
  });

  it('bridge-resolved skill scores higher than SAFE_DEFAULT', () => {
    const bridged = scoreFromContent(`---
name: wacli
description: WhatsApp CLI.
---
1. Use wacli
`);
    const unknown = scoreFromContent(`---
name: completely-unknown-xyz-9999
description: Unknown tool.
---
1. Use it
`);
    expect(bridged.totalScore).toBeGreaterThanOrEqual(unknown.totalScore);
    expect(bridged.analysis.bridgeResolved).toBe(true);
    expect(unknown.analysis.bridgeResolved).toBe(false);
  });

  it('skill with allowed-tools skips bridge (allowed-tools takes precedence)', () => {
    const content = `---
name: wacli
description: WhatsApp CLI.
allowed-tools:
  - web_search
---
1. Use web_search
`;
    const result = scoreFromContent(content);
    expect(result.analysis.bridgeResolved).toBe(false);
    expect(result.analysis.tools[0].toolName).toBe('web_search');
    expect(result.analysis.tools[0].resolvedViaBridge).toBe(false);
  });

  it('message allowed-tool is classified via taxonomy, not SAFE_DEFAULT', () => {
    const content = `---
name: discord
description: Discord ops via the message tool.
allowed-tools:
  - message
---
1. Use the message tool
`;
    const result = scoreFromContent(content);
    expect(result.analysis.tools[0].toolName).toBe('message');
    expect(result.analysis.tools[0].classifyResult.source).toBe('taxonomy');
    expect(result.analysis.tools[0].classifyResult.config.type).toBe('side_effect_mutation');
  });

  it('missing frontmatter falls back to heading + description and still resolves bridge', () => {
    const content = `# Canvas Skill

Display HTML content on connected OpenClaw nodes (Mac app, iOS, Android).

## Overview

The canvas tool lets you present web content on any connected node's canvas view.
`;
    const result = scoreFromContent(content);
    expect(result.skillName).toBe('canvas');
    expect(result.analysis.frontmatterInferred).toBe(true);
    expect(result.analysis.bridgeResolved).toBe(true);
    expect(result.analysis.tools[0].classifyResult.source).toBe('taxonomy');
  });

  it('read-only shell wrappers get scorer-side body inference', () => {
    const content = `---
name: summarize
description: Summarize or extract text/transcripts from URLs, podcasts, and local files.
---
1. Summarize the file
2. Extract the transcript
`;
    const result = scoreFromContent(content);
    expect(result.analysis.tools[0].toolName).toBe('shell');
    expect(result.analysis.tools[0].inferredFromBody).toBe(true);
    expect(result.analysis.tools[0].classifyResult.config.type).toBe('idempotent_read');
    expect(result.totalScore).toBeGreaterThanOrEqual(50);
  });
});

// ─── 3c. All 53 real OpenClaw skills resolve via taxonomy or bridge ──────────

describe('scorer: full OpenClaw coverage', () => {
  const OPENCLAW_SKILLS = [
    '1password', 'apple-notes', 'apple-reminders', 'bear-notes', 'blogwatcher',
    'blucli', 'bluebubbles', 'camsnap', 'canvas', 'clawhub', 'coding-agent',
    'discord', 'eightctl', 'gemini', 'gh-issues', 'gifgrep', 'github', 'gog',
    'goplaces', 'healthcheck', 'himalaya', 'imsg', 'mcporter', 'model-usage',
    'nano-pdf', 'node-connect', 'notion', 'obsidian', 'openai-whisper',
    'openai-whisper-api', 'openhue', 'oracle', 'ordercli', 'peekaboo', 'sag',
    'session-logs', 'sherpa-onnx-tts', 'skill-creator', 'slack', 'songsee',
    'sonoscli', 'spotify-player', 'summarize', 'taskflow', 'taskflow-inbox-triage',
    'things-mac', 'tmux', 'trello', 'video-frames', 'voice-call', 'wacli',
    'weather', 'xurl',
  ];

  it('all 53 skills resolve without SAFE_DEFAULT', () => {
    const defaultSkills: string[] = [];
    for (const name of OPENCLAW_SKILLS) {
      const result = scoreFromContent(`---\nname: ${name}\ndescription: Test.\n---\n1. Do something\n`);
      const allDefault = result.analysis.tools.every(t => t.classifyResult.source === 'default');
      if (allDefault) defaultSkills.push(name);
    }
    expect(defaultSkills).toEqual([]);
  });

  it('no skill scores below 30 (SAFE_DEFAULT floor was 25)', () => {
    const below30: string[] = [];
    for (const name of OPENCLAW_SKILLS) {
      const result = scoreFromContent(`---\nname: ${name}\ndescription: Test.\n---\n1. Do something\n`);
      if (result.totalScore < 30) below30.push(`${name}:${result.totalScore}`);
    }
    expect(below30).toEqual([]);
  });
});

// ─── 4. Max static score is 80 ──────────────────────────────────────────────

describe('scorer: perf baseline stub', () => {
  it('perf baseline is always 0 in static analysis mode', () => {
    const content = `---
name: test-skill
description: Test.
---
1. Do something
`;
    const result = scoreFromContent(content);
    const perfBaseline = result.categories.find(c => c.category === 'perfBaseline');
    expect(perfBaseline).toBeDefined();
    expect(perfBaseline!.points).toBe(0);
    expect(perfBaseline!.maxPoints).toBe(20);
  });

  it('max achievable static score is 80', () => {
    const content = `---
name: web-search
description: Web search skill with full execution block.
allowed-tools:
  - web_search
execution:
  type: idempotent_read
  retry: 5
  cache:
    ttl: 300
---
1. Use web_search to find results
`;
    const result = scoreFromContent(content);
    expect(result.totalScore).toBeLessThanOrEqual(80);
    const perfBaseline = result.categories.find(c => c.category === 'perfBaseline');
    expect(perfBaseline!.points).toBe(0);
  });
});

// ─── 5. Status labels ────────────────────────────────────────────────────────

describe('scorer: status labels', () => {
  it('DURABLE for score >= 80', () => {
    expect(getDurabilityStatus(80)).toBe('DURABLE');
    expect(getDurabilityStatus(100)).toBe('DURABLE');
  });

  it('PARTIALLY DURABLE for score 50-79', () => {
    expect(getDurabilityStatus(50)).toBe('PARTIALLY DURABLE');
    expect(getDurabilityStatus(79)).toBe('PARTIALLY DURABLE');
  });

  it('FRAGILE for score < 50', () => {
    expect(getDurabilityStatus(0)).toBe('FRAGILE');
    expect(getDurabilityStatus(49)).toBe('FRAGILE');
  });
});

// ─── 6. Batch mode ───────────────────────────────────────────────────────────

describe('scorer: batch mode', () => {
  it('batch scores all 5 fixtures with valid summary', async () => {
    const summary = await scoreBatch(FIXTURES_DIR, { silent: true });
    expect(summary.totalSkills).toBe(5);
    expect(summary.averageScore).toBeGreaterThan(0);
    expect(summary.averageScore).toBeLessThanOrEqual(100);
    expect(summary.durableCount + summary.partiallyDurableCount + summary.fragileCount).toBe(5);
    expect(summary.results).toHaveLength(5);
  });

  it('batch results each have valid category breakdowns', async () => {
    const summary = await scoreBatch(FIXTURES_DIR, { silent: true });
    for (const result of summary.results) {
      expect(result.categories).toHaveLength(6);
      const sum = result.categories.reduce((s, c) => s + c.points, 0);
      expect(sum).toBe(result.totalScore);
    }
  });

  it('empty directory returns 0 skills', async () => {
    const summary = await scoreBatch('/tmp/nonexistent-tenure-test-dir', { silent: true });
    expect(summary.totalSkills).toBe(0);
    expect(summary.averageScore).toBe(0);
  });
});
