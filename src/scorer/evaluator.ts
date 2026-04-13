import type { SkillAnalysis, ToolAnalysis, CategoryScore, Finding, Recommendation, ScoreCategory } from './types';
import { CATEGORY_LABELS, CATEGORY_MAX_POINTS } from './types';

/**
 * Six-harness evaluator — computes per-category durability scores.
 *
 * Why it exists: the evaluator is the core of the scoring engine. It takes a
 * SkillAnalysis (the enriched, classified view of a skill) and produces a
 * score for each of the six categories from Six-harness.md.
 *
 * Each category function returns points (clamped to [0, max]) and a list of
 * findings explaining why points were awarded or deducted.
 */

export interface EvaluationResult {
  categories: CategoryScore[];
  findings: Finding[];
  recommendations: Recommendation[];
}

/** Run all six category evaluators and aggregate results. */
export function evaluate(analysis: SkillAnalysis): EvaluationResult {
  const categories: CategoryScore[] = [
    evaluateCrashRecovery(analysis),
    evaluateNoDuplicate(analysis),
    evaluateBudgetCompliance(analysis),
    evaluateHitlCompliance(analysis),
    evaluateTaxonomyCoverage(analysis),
    evaluatePerfBaseline(analysis),
  ];

  const findings = categories.flatMap(c => c.findings);
  const recommendations = generateRecommendations(analysis, categories);

  return { categories, findings, recommendations };
}

// ─── Crash Recovery (20 points) ──────────────────────────────────────────────

function evaluateCrashRecovery(analysis: SkillAnalysis): CategoryScore {
  const max = CATEGORY_MAX_POINTS.crashRecovery;
  const findings: Finding[] = [];
  let points = 0;

  const tools = analysis.tools;

  if (tools.length === 0) {
    // Skill has no tools — give partial credit for having an execution block.
    if (analysis.hasExecutionBlock) {
      points += 8;
      findings.push({ category: 'crashRecovery', points: 8, message: 'Execution block declared (no tools to classify)' });
    } else {
      findings.push({ category: 'crashRecovery', points: 0, message: 'No tools and no execution block — crash recovery cannot be evaluated' });
    }
    return makeScore('crashRecovery', clamp(points, max), findings);
  }

  // +3 per classified tool (up to 12)
  const classifiedTools = tools.filter(t => t.classifyResult.source !== 'default');
  const classifiedPts = Math.min(classifiedTools.length * 3, 12);
  points += classifiedPts;
  if (classifiedPts > 0) {
    findings.push({ category: 'crashRecovery', points: classifiedPts, message: `${classifiedTools.length} of ${tools.length} tools explicitly classified` });
  }
  if (classifiedTools.length < tools.length) {
    findings.push({ category: 'crashRecovery', points: 0, message: `${tools.length - classifiedTools.length} tools using SAFE_DEFAULT classification` });
  }

  // +2 per tool with non-default retry (up to 4)
  const nonDefaultRetry = tools.filter(t => t.classifyResult.config.retryPolicy.maximumAttempts > 1);
  const retryPts = Math.min(nonDefaultRetry.length * 2, 4);
  points += retryPts;
  if (retryPts > 0) {
    findings.push({ category: 'crashRecovery', points: retryPts, message: `${nonDefaultRetry.length} tools have retry policy > 1 attempt` });
  }

  // +2 if compensation declared for any mutation/critical tools
  const mutationTools = tools.filter(t =>
    t.classifyResult.config.type === 'side_effect_mutation' || t.classifyResult.config.type === 'critical_transaction'
  );
  const compensated = mutationTools.filter(t => t.classifyResult.config.compensation);
  if (mutationTools.length > 0 && compensated.length > 0) {
    points += 2;
    findings.push({ category: 'crashRecovery', points: 2, message: `Compensation handler declared for ${compensated.length} mutation/critical tools` });
  }

  // +2 if all known tools have temporal primitive mapping
  const toolsWithMapping = tools.filter(t => t.knownInMapping);
  if (toolsWithMapping.length === tools.length && tools.length > 0) {
    points += 2;
    findings.push({ category: 'crashRecovery', points: 2, message: 'All tools have Temporal primitive mapping in knowledge base' });
  }

  // Deductions
  const unprotectedMutations = mutationTools.filter(t => !t.classifyResult.config.idempotent && !t.classifyResult.config.compensation);
  if (unprotectedMutations.length > 0) {
    const deduction = -Math.min(unprotectedMutations.length * 2, 3);
    points += deduction;
    findings.push({ category: 'crashRecovery', points: deduction, message: `${unprotectedMutations.length} mutation tools without idempotency or compensation` });
  }

  return makeScore('crashRecovery', clamp(points, max), findings);
}

// ─── No-Duplicate (20 points) ────────────────────────────────────────────────

function evaluateNoDuplicate(analysis: SkillAnalysis): CategoryScore {
  const max = CATEGORY_MAX_POINTS.noDuplicate;
  const findings: Finding[] = [];
  let points = 0;

  const tools = analysis.tools;
  const sideEffectTools = tools.filter(t =>
    t.classifyResult.config.type === 'side_effect_mutation' || t.classifyResult.config.type === 'critical_transaction'
  );

  if (tools.length === 0) {
    points = 10;
    findings.push({ category: 'noDuplicate', points: 10, message: 'No tools — no duplicate risk (partial credit)' });
    return makeScore('noDuplicate', clamp(points, max), findings);
  }

  // +8 if all side-effect tools have idempotency key strategy
  if (sideEffectTools.length === 0) {
    points += 8;
    findings.push({ category: 'noDuplicate', points: 8, message: 'No side-effect tools — idempotency not required' });
  } else {
    const withIdempotency = sideEffectTools.filter(t =>
      t.classifyResult.config.idempotent || t.classifyResult.config.idempotencyKeyField
    );
    if (withIdempotency.length === sideEffectTools.length) {
      points += 8;
      findings.push({ category: 'noDuplicate', points: 8, message: 'All side-effect tools have idempotency key strategy' });
    } else {
      const partial = Math.round((withIdempotency.length / sideEffectTools.length) * 8);
      points += partial;
      findings.push({ category: 'noDuplicate', points: partial, message: `${withIdempotency.length}/${sideEffectTools.length} side-effect tools have idempotency` });
    }
  }

  // +6 if all side-effect tools have explicit idempotency config
  const withExplicitConfig = sideEffectTools.filter(t =>
    t.classifyResult.config.idempotent && t.classifyResult.config.idempotencyKeyField
  );
  if (sideEffectTools.length === 0 || withExplicitConfig.length === sideEffectTools.length) {
    points += 6;
    findings.push({ category: 'noDuplicate', points: 6, message: 'Explicit idempotency config on all side-effect tools' });
  } else if (withExplicitConfig.length > 0) {
    const partial = Math.round((withExplicitConfig.length / sideEffectTools.length) * 6);
    points += partial;
    findings.push({ category: 'noDuplicate', points: partial, message: `${withExplicitConfig.length}/${sideEffectTools.length} have explicit idempotency key field` });
  }

  // +4 if no tools classified with SAFE_DEFAULT
  const defaultTools = tools.filter(t => t.classifyResult.source === 'default');
  if (defaultTools.length === 0) {
    points += 4;
    findings.push({ category: 'noDuplicate', points: 4, message: 'All tools explicitly classified (no SAFE_DEFAULT)' });
  } else {
    findings.push({ category: 'noDuplicate', points: 0, message: `${defaultTools.length} tools using SAFE_DEFAULT — dedup behavior unknown` });
  }

  // +2 if classification confidence >= 0.9 for all tools
  const allHighConfidence = tools.every(t => t.classificationConfidence === null || t.classificationConfidence >= 0.9);
  if (allHighConfidence && tools.some(t => t.classificationConfidence !== null)) {
    points += 2;
    findings.push({ category: 'noDuplicate', points: 2, message: 'Classification confidence >= 0.9 for all known tools' });
  }

  // Deductions
  const lowConfidence = tools.filter(t => t.classificationConfidence !== null && t.classificationConfidence < 0.7);
  if (lowConfidence.length > 0) {
    const deduction = -4;
    points += deduction;
    findings.push({ category: 'noDuplicate', points: deduction, message: `${lowConfidence.length} tools with classification confidence < 0.7` });
  }

  return makeScore('noDuplicate', clamp(points, max), findings);
}

// ─── Budget Compliance (15 points) ───────────────────────────────────────────

function evaluateBudgetCompliance(analysis: SkillAnalysis): CategoryScore {
  const max = CATEGORY_MAX_POINTS.budgetCompliance;
  const findings: Finding[] = [];
  let points = 0;

  const tools = analysis.tools;

  // +5 if thinkingCost classified for all tools
  const allHaveThinkingCost = tools.length === 0 || tools.every(t => t.classifyResult.config.thinkingCost !== undefined);
  if (allHaveThinkingCost) {
    points += 5;
    findings.push({ category: 'budgetCompliance', points: 5, message: 'ThinkingCost classified for all tools' });
  }

  // +4 if no high-cost tools without token budget
  const highCostTools = tools.filter(t => t.classifyResult.config.thinkingCost === 'high');
  const highCostWithBudget = highCostTools.filter(t => {
    const eb = analysis.executionBlock as Record<string, unknown> | null;
    return eb && (eb.tokenBudget || eb.token_budget);
  });
  if (highCostTools.length === 0 || highCostWithBudget.length === highCostTools.length) {
    points += 4;
    findings.push({ category: 'budgetCompliance', points: 4, message: 'No high-cost tools without token budget' });
  } else {
    findings.push({ category: 'budgetCompliance', points: 0, message: `${highCostTools.length - highCostWithBudget.length} high-cost tools without token budget declared` });
  }

  // +3 if long-running tools have child workflow strategy
  const longRunning = tools.filter(t => t.classifyResult.config.type === 'long_running_process');
  if (longRunning.length === 0) {
    points += 3;
    findings.push({ category: 'budgetCompliance', points: 3, message: 'No long-running process tools (child budget N/A)' });
  } else {
    const withMapping = longRunning.filter(t => t.knownInMapping);
    if (withMapping.length === longRunning.length) {
      points += 3;
      findings.push({ category: 'budgetCompliance', points: 3, message: 'Long-running tools have documented workflow strategy' });
    }
  }

  // +3 if execution block declares explicit cost tier
  if (analysis.hasExecutionBlock && analysis.executionBlock) {
    const eb = analysis.executionBlock as Record<string, unknown>;
    const hasCost = eb.cost || eb.thinkingCost || eb.thinking_cost;
    if (hasCost) {
      points += 3;
      findings.push({ category: 'budgetCompliance', points: 3, message: 'Execution block declares explicit cost tier' });
    }
  }

  return makeScore('budgetCompliance', clamp(points, max), findings);
}

// ─── HITL Compliance (15 points) ─────────────────────────────────────────────

function evaluateHitlCompliance(analysis: SkillAnalysis): CategoryScore {
  const max = CATEGORY_MAX_POINTS.hitlCompliance;
  const findings: Finding[] = [];
  let points = 0;

  const tools = analysis.tools;
  const criticalTools = tools.filter(t => t.classifyResult.config.type === 'critical_transaction');
  const humanInteractive = tools.filter(t => t.classifyResult.config.type === 'human_interactive');

  // +8 if all critical_transaction tools have hitl: required
  if (criticalTools.length === 0) {
    points += 8;
    findings.push({ category: 'hitlCompliance', points: 8, message: 'No critical transaction tools (HITL N/A)' });
  } else {
    const gated = criticalTools.filter(t => t.classifyResult.config.hitl === 'required');
    if (gated.length === criticalTools.length) {
      points += 8;
      findings.push({ category: 'hitlCompliance', points: 8, message: 'All critical transactions require HITL approval' });
    } else {
      const partial = Math.round((gated.length / criticalTools.length) * 8);
      points += partial;
      findings.push({ category: 'hitlCompliance', points: partial, message: `${gated.length}/${criticalTools.length} critical tools require HITL` });
      const ungated = criticalTools.filter(t => t.classifyResult.config.hitl !== 'required');
      for (const t of ungated) {
        findings.push({ category: 'hitlCompliance', points: 0, message: `${t.toolName} is critical_transaction but hitl=${t.classifyResult.config.hitl}` });
      }
    }
  }

  // +4 if conditional trees include HITL escalation for dangerous edge cases
  const toolsWithEdges = tools.filter(t => t.edgeCaseCount > 0);
  const toolsWithHitlEdge = toolsWithEdges.filter(t => {
    if (!t.knownInMapping) return false;
    return t.hasConditionalTree;
  });
  if (toolsWithEdges.length === 0) {
    points += 2;
    findings.push({ category: 'hitlCompliance', points: 2, message: 'No edge cases documented (partial credit)' });
  } else if (toolsWithHitlEdge.length === toolsWithEdges.length) {
    points += 4;
    findings.push({ category: 'hitlCompliance', points: 4, message: 'Conditional trees cover all documented edge cases' });
  } else if (toolsWithHitlEdge.length > 0) {
    points += 2;
    findings.push({ category: 'hitlCompliance', points: 2, message: `${toolsWithHitlEdge.length}/${toolsWithEdges.length} tools with edge cases have conditional trees` });
  }

  // +3 if human-interactive tools use signal/wait pattern
  if (humanInteractive.length === 0) {
    points += 3;
    findings.push({ category: 'hitlCompliance', points: 3, message: 'No human-interactive tools (signal/wait N/A)' });
  } else {
    const withHitl = humanInteractive.filter(t =>
      t.classifyResult.config.hitl === 'required' || t.classifyResult.config.hitl === 'recommended'
    );
    if (withHitl.length === humanInteractive.length) {
      points += 3;
      findings.push({ category: 'hitlCompliance', points: 3, message: 'Human-interactive tools configured for signal/wait' });
    }
  }

  return makeScore('hitlCompliance', clamp(points, max), findings);
}

// ─── Taxonomy Coverage (10 points) ───────────────────────────────────────────

function evaluateTaxonomyCoverage(analysis: SkillAnalysis): CategoryScore {
  const max = CATEGORY_MAX_POINTS.taxonomyCoverage;
  const findings: Finding[] = [];
  let points = 0;

  const tools = analysis.tools;

  if (tools.length === 0 && analysis.hasExecutionBlock) {
    points = 7;
    findings.push({ category: 'taxonomyCoverage', points: 7, message: 'No tools but execution block declared' });
    return makeScore('taxonomyCoverage', clamp(points, max), findings);
  }

  if (tools.length === 0) {
    points = 3;
    findings.push({ category: 'taxonomyCoverage', points: 3, message: 'No tools to classify (minimal credit)' });
    return makeScore('taxonomyCoverage', clamp(points, max), findings);
  }

  // +5 if all tools in taxonomy or have explicit execution block
  const inTaxonomy = tools.filter(t => t.classifyResult.source === 'taxonomy' || t.classifyResult.source === 'conditional' || t.classifyResult.source === 'bridge');
  if (inTaxonomy.length === tools.length) {
    points += 5;
    findings.push({ category: 'taxonomyCoverage', points: 5, message: `All ${tools.length} tools found in taxonomy` });
  } else if (analysis.hasExecutionBlock && inTaxonomy.length > 0) {
    points += 4;
    findings.push({ category: 'taxonomyCoverage', points: 4, message: `${inTaxonomy.length}/${tools.length} in taxonomy, execution block covers rest` });
  } else {
    const partial = Math.round((inTaxonomy.length / tools.length) * 5);
    points += partial;
    findings.push({ category: 'taxonomyCoverage', points: partial, message: `${inTaxonomy.length}/${tools.length} tools found in taxonomy` });
  }

  // +3 if classification source is not 'default' for all tools
  const explicitlyClassified = tools.filter(t => t.classifyResult.source !== 'default');
  if (explicitlyClassified.length === tools.length) {
    points += 3;
    findings.push({ category: 'taxonomyCoverage', points: 3, message: 'All tools explicitly classified (no fallback)' });
  }

  // +2 if static classification sufficient or runtime signals documented
  const staticOrDocumented = tools.filter(t =>
    t.staticSufficient === true || (t.runtimeInferenceRequired === true && t.edgeCaseCount > 0)
  );
  if (tools.length > 0 && staticOrDocumented.length === tools.length) {
    points += 2;
    findings.push({ category: 'taxonomyCoverage', points: 2, message: 'Static classification sufficient or runtime signals documented for all tools' });
  } else if (staticOrDocumented.length > 0) {
    points += 1;
    findings.push({ category: 'taxonomyCoverage', points: 1, message: `${staticOrDocumented.length}/${tools.length} tools have sufficient classification coverage` });
  }

  return makeScore('taxonomyCoverage', clamp(points, max), findings);
}

// ─── Perf Baseline (20 points) — stub ────────────────────────────────────────

function evaluatePerfBaseline(_analysis: SkillAnalysis): CategoryScore {
  return makeScore('perfBaseline', 0, [{
    category: 'perfBaseline',
    points: 0,
    message: 'Perf Baseline requires runtime history (static analysis: 0/20)',
  }]);
}

// ─── Recommendations ─────────────────────────────────────────────────────────

function generateRecommendations(analysis: SkillAnalysis, categories: CategoryScore[]): Recommendation[] {
  const recs: Recommendation[] = [];

  if (!analysis.hasExecutionBlock) {
    recs.push({
      category: 'taxonomyCoverage',
      message: 'Add execution: block to SKILL.md frontmatter with type + idempotency config',
      potentialPoints: 5,
    });
  }

  const crashScore = categories.find(c => c.category === 'crashRecovery');
  if (crashScore && crashScore.points < crashScore.maxPoints) {
    const unclassified = analysis.tools.filter(t => t.classifyResult.source === 'default');
    if (unclassified.length > 0) {
      recs.push({
        category: 'crashRecovery',
        message: `Classify ${unclassified.length} unknown tools in TAXONOMY.md or via execution: block`,
        potentialPoints: Math.min(unclassified.length * 3, 6),
      });
    }
  }

  const hitlScore = categories.find(c => c.category === 'hitlCompliance');
  if (hitlScore && hitlScore.points < hitlScore.maxPoints) {
    const ungated = analysis.tools.filter(t =>
      t.classifyResult.config.type === 'critical_transaction' && t.classifyResult.config.hitl !== 'required'
    );
    for (const t of ungated) {
      recs.push({
        category: 'hitlCompliance',
        message: `Add hitl: required for ${t.toolName} (critical_transaction)`,
        potentialPoints: 4,
      });
    }
  }

  const dupScore = categories.find(c => c.category === 'noDuplicate');
  if (dupScore && dupScore.points < dupScore.maxPoints) {
    const noIdem = analysis.tools.filter(t =>
      (t.classifyResult.config.type === 'side_effect_mutation' || t.classifyResult.config.type === 'critical_transaction') &&
      !t.classifyResult.config.idempotent
    );
    if (noIdem.length > 0) {
      recs.push({
        category: 'noDuplicate',
        message: `Add idempotency keys for ${noIdem.length} side-effect tools`,
        potentialPoints: 4,
      });
    }
  }

  recs.push({
    category: 'perfBaseline',
    message: `Run: tenure run ./skill/SKILL.md 5 times to build Perf Baseline (+20 pts)`,
    potentialPoints: 20,
  });

  return recs;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(points: number, max: number): number {
  return Math.max(0, Math.min(points, max));
}

function makeScore(category: ScoreCategory, points: number, findings: Finding[]): CategoryScore {
  const maxPoints = CATEGORY_MAX_POINTS[category];
  return {
    category,
    label: CATEGORY_LABELS[category],
    points,
    maxPoints,
    passed: points >= maxPoints * 0.6,
    findings,
  };
}
