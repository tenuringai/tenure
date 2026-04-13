import * as crypto from 'crypto';

/**
 * Content hash for SkillPlan versioning.
 *
 * Why it exists: the SkillPlan version is a content hash of the raw SKILL.md file.
 * When a skill is "tenured" — compiled to a Temporal Workflow — the version is
 * embedded in the Workflow metadata. This is the pin mechanism: the Workflow
 * references exactly the skill file that was parsed, not a mutable path.
 *
 * Temporal replay correctness depends on the SkillPlan being deterministic.
 * The hash is derived from file content only, not from timestamps or filesystem
 * metadata, so the same file always produces the same version.
 */
export function hashSkillContent(rawContent: string): string {
  return crypto.createHash('sha256').update(rawContent, 'utf8').digest('hex');
}
