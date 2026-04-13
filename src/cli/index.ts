#!/usr/bin/env node

/**
 * Tenure CLI entry point.
 *
 * Routes top-level commands to their handlers. Each command is a separate module
 * so the CLI stays thin and the actual logic is importable by tests and scripts.
 *
 * Commands:
 *   connect  — connect Tenure to an OpenClaw session
 *   certify  — run certification suite (--demo cron, --ci)
 *   scan     — classify skills in a directory
 *   demo     — run standalone proof demos (--standalone)
 *   extend   — extend a skill with Tenure metadata (Phase 2)
 */

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'demo':
    handleDemo(args);
    break;
  case 'connect':
  case 'certify':
  case 'scan':
  case 'extend':
    console.log(`[tenure] Command '${command}' is not yet implemented.`);
    process.exit(1);
    break;
  default:
    printHelp();
    break;
}

function handleDemo(args: string[]): void {
  if (args.includes('--standalone')) {
    // Dynamic import to avoid loading Temporal SDK eagerly on help/version.
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
    console.log(`         Runs the cron-durability proof without OpenClaw.`);
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
  tenure — durable skill execution for OpenClaw

  Usage:
    tenure demo --standalone   Run standalone cron-durability proof
    tenure connect openclaw    Connect Tenure to an OpenClaw session
    tenure certify --demo cron Run cron certification demo
    tenure certify --ci        Run full certification suite
    tenure scan ./skills       Classify skills in a directory

  Options:
    --help                     Show this help
`);
}
