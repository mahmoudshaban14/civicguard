import type { AiSeverity, CategoryOption, ProviderOutput } from './types.js';

export const MANUAL_REVIEW_CONFIDENCE = 0.7;
const LEVELS: AiSeverity[] = ['Low', 'Medium', 'High', 'Critical'];

export interface AnalysisResult {
  category_id: string;
  category: string;
  department: string;
  department_id: string | null;
  severity: AiSeverity | 'Requires Review';
  severity_reason: string;
  confidence: number;
  image_description: string;
  explanation: string;
  secondary_issues: string[]; // category ids
  immediate_danger: boolean;
  requires_manual_review: boolean;
  recommended_action: string;
}

function clamp01(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return Math.min(1, Math.max(0, v));
}

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * Turns untrusted model output into a trusted result.
 *  - category must exist in the DB list (else "other" + manual review)
 *  - department always comes from the category row, never from the model
 *  - severity may differ from the category default by at most one level
 *    (and is at least High when the model flags immediate danger)
 */
export function applyRules(out: ProviderOutput, categories: CategoryOption[]): AnalysisResult {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const fallback = byId.get('other');

  let category = byId.get(out.category_id);
  let forceReview = false;
  if (!category) {
    category = fallback ?? categories[0];
    forceReview = true;
  }

  const confidence = clamp01(out.confidence);
  const notCivic = out.is_civic_issue === false;
  if (notCivic && fallback) category = fallback;

  const requiresManualReview =
    forceReview || notCivic || category.id === 'other' || confidence < MANUAL_REVIEW_CONFIDENCE;

  let severity: AiSeverity | 'Requires Review';
  const modelLevel = LEVELS.indexOf(out.severity);
  const defaultLevel = LEVELS.indexOf((category.default_severity ?? '') as AiSeverity);
  if (requiresManualReview && (category.id === 'other' || notCivic)) {
    severity = 'Requires Review';
  } else if (modelLevel < 0) {
    severity = defaultLevel >= 0 ? LEVELS[defaultLevel] : 'Medium';
  } else if (defaultLevel < 0) {
    severity = LEVELS[modelLevel];
  } else {
    const bounded = Math.min(defaultLevel + 1, Math.max(defaultLevel - 1, modelLevel));
    severity = LEVELS[bounded];
  }
  if (out.immediate_danger === true && !notCivic) {
    const level = severity === 'Requires Review' ? -1 : LEVELS.indexOf(severity);
    if (level < LEVELS.indexOf('High')) severity = 'High';
  }

  const secondary = Array.from(
    new Set((out.secondary_category_ids ?? []).filter((id) => byId.has(id) && id !== category.id)),
  ).slice(0, 3);

  return {
    category_id: category.id,
    category: category.label,
    department: requiresManualReview && category.id === 'other' ? 'Manual Routing' : category.department,
    department_id: category.department_id,
    severity,
    severity_reason: text(out.severity_reason, 500),
    confidence,
    image_description: text(out.image_description, 800),
    explanation: text(out.image_description, 800) || (category.explanation ?? ''),
    secondary_issues: secondary,
    immediate_danger: out.immediate_danger === true,
    requires_manual_review: requiresManualReview,
    recommended_action: text(out.recommended_action, 400),
  };
}

/** Result used when AI is unavailable (no key, timeout, bad output). */
export function manualReviewFallback(categories: CategoryOption[]): AnalysisResult {
  const other = categories.find((c) => c.id === 'other') ?? categories[0];
  return {
    category_id: other.id,
    category: other.label,
    department: 'Manual Routing',
    department_id: other.department_id,
    severity: 'Requires Review',
    severity_reason: 'Automatic analysis was unavailable, so a human must review this report.',
    confidence: 0,
    image_description: '',
    explanation: 'Automatic analysis was unavailable.',
    secondary_issues: [],
    immediate_danger: false,
    requires_manual_review: true,
    recommended_action: 'Route to manual review.',
  };
}
