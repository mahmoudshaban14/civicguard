export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export type AiSeverity = (typeof SEVERITIES)[number];

/** A category the model is allowed to choose from (loaded from the DB). */
export interface CategoryOption {
  id: string;
  label: string;
  department: string;
  department_id: string | null;
  default_severity: string | null;
  explanation: string | null;
}

export interface ProviderInput {
  image: { bytes: Buffer; mimeType: string };
  description: string | null;
  categories: CategoryOption[];
  location: { latitude: number; longitude: number; areaName?: string | null };
}

/** What the model returns. Always treated as untrusted until rules.ts runs. */
export interface ProviderOutput {
  image_description: string;
  is_civic_issue: boolean;
  category_id: string;
  confidence: number; // 0..1
  secondary_category_ids: string[];
  severity: AiSeverity;
  severity_reason: string;
  immediate_danger: boolean;
  recommended_action: string;
}

export interface CompareInput {
  a: { bytes: Buffer; mimeType: string };
  b: { bytes: Buffer; mimeType: string };
  categoryLabel: string;
}

export interface CompareOutput {
  same_issue: boolean;
  confidence: number; // 0..1
  reason: string;
}

export interface AiProvider {
  readonly name: string;
  analyze(input: ProviderInput): Promise<ProviderOutput>;
  /** Do two photos show the same physical problem? Optional so mocks can omit it. */
  compareImages?(input: CompareInput): Promise<CompareOutput>;
}
