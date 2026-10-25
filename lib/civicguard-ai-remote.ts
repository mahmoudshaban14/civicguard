import { apiClient } from '@/lib/api-client';
import { getCategoryById, type CivicIssueId } from '@/lib/civicguard-categories';
import type { CivicAnalysisResult } from '@/lib/civicguard-ai';
import type { Severity } from '@/lib/civicguard-data';
import { supabase } from '@/lib/supabase';

const BUCKET = 'report-images';

/** Shape returned by POST /v1/reports/analyze (see backend/src/modules/analysis). */
interface AnalyzeApiResponse {
  analysis_id: string | null;
  source: 'gemini' | 'fallback';
  model: string | null;
  result: {
    category_id: string;
    category: string;
    department: string;
    severity: Severity;
    severity_reason: string;
    confidence: number; // 0..1
    image_description: string;
    explanation: string;
    secondary_issues: string[];
    immediate_danger: boolean;
    requires_manual_review: boolean;
    recommended_action: string;
  };
}

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function detectImageType(uri: string): { ext: 'jpg' | 'png' | 'webp'; contentType: string } {
  if (uri.startsWith('data:image/png')) return { ext: 'png', contentType: 'image/png' };
  if (uri.startsWith('data:image/webp')) return { ext: 'webp', contentType: 'image/webp' };
  const ext = uri.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  if (ext === 'png') return { ext: 'png', contentType: 'image/png' };
  if (ext === 'webp') return { ext: 'webp', contentType: 'image/webp' };
  return { ext: 'jpg', contentType: 'image/jpeg' };
}

/** Uploads a local image through a backend-signed URL and returns its storage path. */
export async function uploadReportImage(imageUri: string, token: string): Promise<string> {
  const { contentType } = detectImageType(imageUri);
  const signed = await apiClient<{ path: string; token: string }>('/v1/uploads/sign', {
    method: 'POST',
    token,
    body: JSON.stringify({ contentType }),
  });
  const bytes = await (await fetch(imageUri)).arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, bytes, { contentType });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return signed.path;
}

export interface RemoteAnalysisInput {
  imageUri: string;
  description: string;
  latitude: number;
  longitude: number;
  area: string;
}

/**
 * Uploads the photo, asks Gemini (through our backend) to analyze it and maps
 * the answer to the shape the UI already understands. Throws on network /
 * auth errors so the caller can fall back to the offline prototype classifier.
 */
export async function analyzeWithGemini(input: RemoteAnalysisInput): Promise<CivicAnalysisResult> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not signed in');

  const imagePath = await uploadReportImage(input.imageUri, token);
  const response = await apiClient<AnalyzeApiResponse>('/v1/reports/analyze', {
    method: 'POST',
    token,
    body: JSON.stringify({
      image_path: imagePath,
      description: input.description || undefined,
      latitude: input.latitude,
      longitude: input.longitude,
      area_name: input.area || undefined,
    }),
  });

  const r = response.result;
  const category = getCategoryById(r.category_id as CivicIssueId);
  return {
    category: category.label,
    categoryId: category.id,
    confidence: Math.round(r.confidence * 100),
    severity: r.severity,
    severityReason: r.severity_reason || category.severityReason,
    explanation: r.explanation || category.explanation,
    department: r.department,
    secondaryIssues: r.secondary_issues.map((id) => getCategoryById(id as CivicIssueId).label),
    requiresManualReview: r.requires_manual_review,
    possibleDuplicate: 'No matching active report found',
    recommendedAction: r.recommended_action || 'Forward the report to the responsible authority for inspection.',
    source: response.source,
    imageDescription: r.image_description,
    immediateDanger: r.immediate_danger,
    analysisId: response.analysis_id ?? undefined,
    imagePath,
  };
}
