import { activityInfo, heartbeat } from '@temporalio/activity';
import OpenAI from 'openai';
import type { ThinkingStepInput, ThinkingStepOutput } from './activity-dispatch';
import { MODEL_TIER_MAP } from '../parser/types';
import type { ModelTier } from '../parser/types';

/**
 * Thinking Activity — calls OpenAI with a reasoning prompt and prior step context.
 *
 * Why it exists: thinking steps in a SkillPlan represent reasoning, decision-making,
 * or interpretation work that requires an LLM. They compile to this Activity, which
 * runs in the main Temporal Worker process with full Node API access.
 *
 * Follows zeitlich's proxyRunAgent pattern for LLM activities:
 * - 10m startToCloseTimeout (configured in activity-dispatch.ts THINKING_ACTIVITY_OPTIONS)
 * - 1m heartbeatTimeout (we emit heartbeats during long completions)
 * - 3 retries with exponential backoff
 *
 * Model routing: modelTier maps to OpenAI model names.
 *   frontier → gpt-4o
 *   mid      → gpt-4o-mini (default)
 *   cheap    → gpt-3.5-turbo
 */
export async function executeThinkingStep(input: ThinkingStepInput): Promise<ThinkingStepOutput> {
  const startMs = Date.now();
  const info = activityInfo();

  activityInfo().logger?.info(`[ThinkingActivity] stepId=${input.stepId} model=${input.modelTier} tokenBudget=${input.tokenBudget}`);

  const model = MODEL_TIER_MAP[input.modelTier as ModelTier] ?? MODEL_TIER_MAP['mid'];
  const client = new OpenAI();

  // Build context from prior step results.
  const contextLines: string[] = [];
  if (input.priorContext.length > 0) {
    contextLines.push('Prior step results:');
    for (const ctx of input.priorContext) {
      contextLines.push(`- ${ctx.stepId}: ${JSON.stringify(ctx.result)}`);
    }
  }

  const systemPrompt = [
    'You are a durable AI agent executing a skill workflow. Each step you receive is a reasoning or decision task.',
    'Be concise and structured. Return your reasoning as plain text.',
    ...(contextLines.length > 0 ? ['\n' + contextLines.join('\n')] : []),
  ].join('\n');

  const completionParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input.prompt },
    ],
    ...(input.tokenBudget > 0 ? { max_tokens: input.tokenBudget } : {}),
  };

  // Emit a heartbeat before the API call so Temporal knows we're alive.
  heartbeat({ stepId: input.stepId, status: 'calling_llm' });

  const completion = await client.chat.completions.create(completionParams);

  const response = completion.choices[0]?.message?.content ?? '';
  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;

  activityInfo().logger?.info(`[ThinkingActivity] stepId=${input.stepId} done — ${Date.now() - startMs}ms, tokens=${inputTokens}+${outputTokens}`);

  return {
    stepId: input.stepId,
    response,
    inputTokens,
    outputTokens,
  };
}
