/**
 * Combined workflow entry point — bundles all Tenure workflows for the Worker.
 *
 * Why it exists: Temporal's Worker.create() accepts a single workflowsPath.
 * This file re-exports all workflow functions from both the adapter and the
 * compiler so the Worker bundle includes both.
 *
 * Temporal's bundler resolves all imports from this entry point and builds an
 * isolated V8 sandbox. Both workflows are available for dispatch.
 */
export { agentSessionWorkflow, dispatchToolUpdate, shutdownSignal, sessionStatsQuery } from './agent-session';
export { appendLineWorkflow } from './append-line';
export { skillExecutionWorkflow } from '../../compiler/workflow-builder';
