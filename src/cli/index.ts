#!/usr/bin/env node

/**
 * Tenure CLI — SKILL.md-to-Temporal compiler.
 *
 * Why it exists: the CLI is the user surface of the engine. Each command maps
 * to one stage of the pipeline or a proof mode.
 *
 * Commands:
 *   run      — parse + classify + compile → running Temporal Workflow or Schedule
 *   scan     — classify skills in a directory, output the execution type table
 *   certify  — run certification proofs (--demo cron, --ci)
 *   create   — LLM-powered ingest (deferred to post-launch)
 *   demo     — standalone proof demos (--standalone) [legacy, kept for compat]
 *   connect  — connect to an OpenClaw session via adapter [optional integration]
 */

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'run':
    handleRun(args);
    break;
  case 'scan':
    handleScan(args);
    break;
  case 'certify':
    handleCertify(args);
    break;
  case 'create':
    handleCreate();
    break;
  case 'demo':
    handleDemo(args);
    break;
  case 'connect':
    console.log(`[tenure] OpenClaw adapter integration — coming soon.`);
    console.log(`         The adapter lives at src/adapter/openclaw/ and is one optional integration.`);
    console.log(`         See: https://github.com/tenuringai/tenure#openclawed-adapter`);
    process.exit(0);
    break;
  default:
    printHelp();
    break;
}

// ─── run command ─────────────────────────────────────────────────────────────

function handleRun(args: string[]): void {
  // Parse flags
  const cronIdx = args.indexOf('--cron');
  const cronExpression = cronIdx !== -1 ? args[cronIdx + 1] : undefined;

  // Find the SKILL.md path — the last non-flag argument
  const skillPath = args.filter((a, i) => {
    if (a.startsWith('--')) return false;
    if (cronIdx !== -1 && i === cronIdx + 1) return false; // skip cron value
    return true;
  }).pop();

  if (!skillPath) {
    console.error(`[tenure] run requires a path to a SKILL.md file`);
    console.error(`         Usage: tenure run [--cron "*/5 * * * *"] ./skill/SKILL.md`);
    process.exit(1);
    return;
  }

  import('../parser/index').then(async ({ parse }) => {
    console.log(`[tenure] Parsing: ${skillPath}`);
    const plan = await parse(skillPath);
    console.log(`[tenure] Skill: ${plan.name}`);
    console.log(`[tenure] Version: ${plan.version.slice(0, 16)}...`);
    console.log(`[tenure] Steps: ${plan.steps.length} (${plan.steps.filter(s => s.type === 'tool_call').length} tool_call, ${plan.steps.filter(s => s.type === 'thinking').length} thinking)`);

    if (cronExpression) {
      console.log(`[tenure] Cron: ${cronExpression}`);
    }

    const { compile } = await import('../compiler/index');
    const result = await compile(plan, cronExpression ? { cron: cronExpression } : {});

    if (result.type === 'workflow') {
      console.log(`\n[tenure] ✓ Workflow started`);
      console.log(`         ID:      ${result.workflowId}`);
      console.log(`         Skill:   ${result.skillName}`);
      console.log(`         Version: ${result.skillVersion.slice(0, 16)}...`);
      console.log(`\n         View at: http://localhost:8233/namespaces/default/workflows/${result.workflowId}`);
    } else {
      console.log(`\n[tenure] ✓ Schedule created`);
      console.log(`         ID:      ${result.scheduleId}`);
      console.log(`         Skill:   ${result.skillName}`);
      console.log(`         Cron:    ${cronExpression}`);
      console.log(`\n         View at: http://localhost:8233/namespaces/default/schedules/${result.scheduleId}`);
    }

    process.exit(0);
  }).catch((err: Error) => {
    console.error(`[tenure] run failed: ${err.message}`);
    if (err.message.includes('ECONNREFUSED') || err.message.includes('connect')) {
      console.error(`\n[tenure] Is Temporal dev server running?`);
      console.error(`         temporal server start-dev`);
    }
    if (err.message.includes('name') || err.message.includes('description')) {
      console.error(`\n[tenure] SKILL.md is missing required frontmatter fields.`);
      console.error(`         Required: name, description`);
    }
    process.exit(1);
  });
}

// ─── scan command ────────────────────────────────────────────────────────────

function handleScan(args: string[]): void {
  const directory = args.find(a => !a.startsWith('--')) ?? '.';

  import('../scanner/index').then(async ({ scan }) => {
    await scan(directory);
    process.exit(0);
  }).catch((err: Error) => {
    console.error(`[tenure] scan failed: ${err.message}`);
    process.exit(1);
  });
}

// ─── certify command ─────────────────────────────────────────────────────────

function handleCertify(args: string[]): void {
  if (args.includes('--demo') && args.includes('cron')) {
    // Run the cron demo using the SKILL.md pipeline
    import('../certify/index').then(async ({ certifyDemoCron }) => {
      const result = await certifyDemoCron();
      process.exit(result.passed ? 0 : 1);
    }).catch((err: Error) => {
      console.error(`[tenure] certify --demo cron failed: ${err.message}`);
      if (err.message.includes('ECONNREFUSED')) {
        console.error(`\n[tenure] Is Temporal dev server running?`);
        console.error(`         temporal server start-dev`);
      }
      process.exit(1);
    });
  } else if (args.includes('--ci')) {
    import('../certify/index').then(async ({ certifyCI }) => {
      const result = await certifyCI();
      process.exit(result.passed ? 0 : 1);
    }).catch((err: Error) => {
      console.error(`[tenure] certify --ci failed: ${err.message}`);
      process.exit(1);
    });
  } else {
    console.log(`[tenure] Usage:`);
    console.log(`         tenure certify --demo cron   Run cron durability proof`);
    console.log(`         tenure certify --ci          Run full certification suite`);
    process.exit(1);
  }
}

// ─── create command (deferred) ───────────────────────────────────────────────

function handleCreate(): void {
  console.log(`[tenure] 'create' is deferred to post-launch.`);
  console.log(`\n         Tenure's engine is the moat — not the authoring layer.`);
  console.log(`         Use skill-creator to author SKILL.md files:`);
  console.log(`           https://github.com/compound-engineering/skill-creator`);
  console.log(`\n         Once you have a SKILL.md, run it:`);
  console.log(`           tenure run ./your-skill/SKILL.md`);
  process.exit(0);
}

// ─── demo command (legacy, kept for compat) ──────────────────────────────────

function handleDemo(args: string[]): void {
  if (args.includes('--standalone')) {
    import('./demo').then(async ({ runStandaloneDemo }) => {
      const result = await runStandaloneDemo();
      process.exit(result.passed ? 0 : 1);
    }).catch((err: Error) => {
      console.error(`[tenure] Demo failed: ${err.message}`);
      if (err.message.includes('ECONNREFUSED') || err.message.includes('connect')) {
        console.error(`\n[tenure] Is Temporal dev server running?`);
        console.error(`         temporal server start-dev`);
      }
      process.exit(1);
    });
  } else {
    console.log(`[tenure] Usage: tenure demo --standalone`);
    process.exit(1);
  }
}

// ─── help ────────────────────────────────────────────────────────────────────

function printHelp(): void {
  console.log(`
  tenure — SKILL.md-to-Temporal compiler

  Usage:
    tenure run ./skill/SKILL.md                  Parse + classify + compile → Workflow
    tenure run --cron "*/5 * * * *" ./skill/...  Compile to a cron Schedule
    tenure scan ./skills                          Classify all skills in a directory
    tenure certify --demo cron                   Run cron durability proof
    tenure certify --ci                          Run full certification suite
    tenure create                                LLM ingest (deferred to post-launch)

  Examples:
    tenure run ./test/fixtures/cron-log-skill/SKILL.md
    tenure run --cron "*/60 * * * * *" ./test/fixtures/cron-log-skill/SKILL.md
    tenure scan ./skills
    tenure certify --demo cron

  Options:
    --help                                       Show this help
`);
}
