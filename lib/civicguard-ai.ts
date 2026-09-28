import {
  CIVIC_ISSUE_CATEGORIES,
  getCategoryById,
  type CivicIssueCategory,
  type CivicIssueConfig,
  type CivicIssueId,
} from '@/lib/civicguard-categories';
import type { SampleImageKey, Severity } from '@/lib/civicguard-data';

export interface CivicImageInput {
  imageKey: SampleImageKey;
  scenarioKey?: CivicIssueId | 'custom';
  uri?: string;
  fileName?: string;
}

export interface CivicLocationInput {
  latitude: number;
  longitude: number;
  area: string;
}

export interface CivicAnalysisResult {
  category: CivicIssueCategory;
  categoryId: CivicIssueId;
  confidence: number;
  severity: Severity;
  severityReason: string;
  explanation: string;
  department: string;
  secondaryIssues: CivicIssueCategory[];
  requiresManualReview: boolean;
  possibleDuplicate: string;
  recommendedAction: string;
  source: 'prototype';
}

const SCENARIO_CONFIDENCE: Partial<Record<CivicIssueId, number>> = {
  pothole: 94,
  garbage: 91,
  'fallen-tree': 96,
  'broken-streetlight': 89,
  'illegal-parking': 87,
  'flooded-street': 92,
  'open-manhole': 97,
  'damaged-sign': 88,
  'construction-debris': 93,
  graffiti: 90,
};

const IMAGE_KEY_CATEGORY: Record<SampleImageKey, CivicIssueId> = {
  pothole: 'pothole',
  garbage: 'garbage',
  streetlight: 'broken-streetlight',
  'fallen-tree': 'fallen-tree',
  'illegal-parking': 'illegal-parking',
  'flooded-street': 'flooded-street',
  'open-manhole': 'open-manhole',
  'damaged-sign': 'damaged-sign',
  'construction-debris': 'construction-debris',
  graffiti: 'graffiti',
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function deterministicNumber(seed: string, minimum: number, maximum: number) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return minimum + ((hash >>> 0) % (maximum - minimum + 1));
}

function keywordScore(text: string, category: CivicIssueConfig) {
  return category.keywords.reduce((score, keyword) => {
    if (!text.includes(keyword)) return score;
    return score + (keyword.includes(' ') ? 8 : 3);
  }, 0);
}

function createResult(
  category: CivicIssueConfig,
  confidence: number,
  secondaryIssues: CivicIssueCategory[],
): CivicAnalysisResult {
  const requiresManualReview = confidence < 70 || category.id === 'other';
  return {
    category: category.label,
    categoryId: category.id,
    confidence,
    severity: requiresManualReview ? 'Requires Review' : category.severity,
    severityReason: category.severityReason,
    explanation: category.explanation,
    department: requiresManualReview ? 'Manual Routing' : category.department,
    secondaryIssues,
    requiresManualReview,
    possibleDuplicate: 'No matching active report found',
    recommendedAction: requiresManualReview
      ? 'Submit the report for manual review or add clearer evidence.'
      : 'Forward the report to the responsible authority for inspection.',
    source: 'prototype',
  };
}

/**
 * Deterministic local prototype classifier. It uses bundled scenario identity,
 * image filename, and the citizen description. It does not run a vision model.
 */
export async function analyzeCivicImage(
  image: CivicImageInput,
  description: string,
  location: CivicLocationInput,
  preferredCategory?: CivicIssueCategory,
): Promise<CivicAnalysisResult> {
  const context = normalize(`${image.fileName ?? ''} ${description}`);
  const scenarioId =
    image.scenarioKey && image.scenarioKey !== 'custom'
      ? image.scenarioKey
      : IMAGE_KEY_CATEGORY[image.imageKey];

  const scored = CIVIC_ISSUE_CATEGORIES.filter((category) => category.id !== 'other')
    .map((category) => {
      const descriptionScore = keywordScore(context, category);
      const scenarioScore = category.id === scenarioId && image.scenarioKey !== 'custom' ? 6 : 0;
      const preferredScore = category.label === preferredCategory ? 20 : 0;
      return {
        category,
        descriptionScore,
        score: descriptionScore + scenarioScore + preferredScore,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.category.label.localeCompare(right.category.label),
    );

  const customWithoutEvidence = image.scenarioKey === 'custom' && scored.length === 0;
  if (customWithoutEvidence) {
    const unknown = getCategoryById('other');
    const confidence = deterministicNumber(
      `${image.fileName ?? image.uri ?? 'custom'}|${description}|${location.area}`,
      45,
      69,
    );
    return createResult(unknown, confidence, []);
  }

  const primary = scored[0]?.category ?? getCategoryById(scenarioId);
  const descriptionChangedScenario =
    scored[0]?.descriptionScore > 0 && primary.id !== scenarioId && !preferredCategory;
  const [minimum, maximum] = primary.confidenceRange;
  const scenarioConfidence = SCENARIO_CONFIDENCE[primary.id];
  const confidence =
    !descriptionChangedScenario &&
    image.scenarioKey !== 'custom' &&
    scenarioConfidence !== undefined
      ? scenarioConfidence
      : deterministicNumber(
          `${image.fileName ?? image.imageKey}|${description}|${primary.id}|${location.area}`,
          descriptionChangedScenario ? Math.max(76, minimum) : minimum,
          descriptionChangedScenario ? Math.min(91, maximum) : maximum,
        );
  const secondaryIssues = scored
    .filter((candidate) => candidate.category.id !== primary.id && candidate.descriptionScore > 0)
    .slice(0, 3)
    .map((candidate) => candidate.category.label);

  return createResult(primary, confidence, secondaryIssues);
}
