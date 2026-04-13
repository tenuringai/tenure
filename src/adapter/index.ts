/**
 * OpenClaw adapter — re-exported from src/adapter/openclaw/.
 *
 * Why this shim exists: the adapter is one optional integration among many.
 * The implementation lives in src/adapter/openclaw/ to signal that explicitly.
 * This re-export preserves backward compatibility for any code that imports
 * from 'src/adapter' directly (e.g., the e2e test script).
 */
export * from './openclaw/index';
