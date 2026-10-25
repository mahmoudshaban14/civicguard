import { config } from '../../config.js';
import { getSupabaseAdmin } from '../../db/client.js';
import type { AuthUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';
import { getAiProvider } from './provider.js';
import { applyRules, manualReviewFallback, type AnalysisResult } from './rules.js';
import type { AnalyzeReportInput } from './schema.js';
import type { CategoryOption } from './types.js';

const STORAGE_BUCKET = 'report-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type AnalysisSource = 'gemini' | 'fallback';

export interface AnalysisResponse {
  analysis_id: string | null;
  source: AnalysisSource;
  model: string | null;
  result: AnalysisResult;
}

/** Detects the real image type from magic bytes (never trust the file name). */
export function sniffImageMime(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP')
    return 'image/webp';
  return null;
}

async function loadCategories(): Promise<CategoryOption[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('categories')
    .select('id, label, department, department_id, default_severity, explanation')
    .eq('active', true);
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  if (!data || data.length === 0) throw new Error('No active categories configured');
  return data as CategoryOption[];
}

async function enforceRateLimit(userId: string) {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('ai_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);
  if (error) throw new Error(`Failed to check AI rate limit: ${error.message}`);
  if ((count ?? 0) >= config.AI_ANALYSES_PER_HOUR) {
    throw new AppError(
      429,
      'AI_RATE_LIMIT',
      `You can analyze up to ${config.AI_ANALYSES_PER_HOUR} photos per hour. Please try again later.`,
    );
  }
}

export async function analyzeReportImage(
  user: AuthUser,
  input: AnalyzeReportInput,
): Promise<AnalysisResponse> {
  // The image must live in the caller's own storage folder.
  if (!input.image_path.startsWith(`${user.id}/`)) {
    throw new AppError(400, 'INVALID_IMAGE_PATH', "image_path must be in the authenticated user's own storage folder");
  }

  await enforceRateLimit(user.id);

  const supabase = getSupabaseAdmin();
  const { data: blob, error: dlError } = await supabase.storage.from(STORAGE_BUCKET).download(input.image_path);
  if (dlError || !blob) {
    throw new AppError(404, 'IMAGE_NOT_FOUND', 'Uploaded image not found. Upload it first via /v1/uploads/sign.');
  }
  const bytes = Buffer.from(await blob.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new AppError(400, 'INVALID_IMAGE', 'Image must be between 1 byte and 5MB');
  }
  const mimeType = sniffImageMime(bytes);
  if (!mimeType) {
    throw new AppError(400, 'INVALID_IMAGE', 'File is not a valid JPEG, PNG or WebP image');
  }

  const categories = await loadCategories();
  const provider = getAiProvider();

  const started = Date.now();
  let result: AnalysisResult;
  let source: AnalysisSource = 'gemini';
  let errorMessage: string | null = null;

  if (!provider) {
    result = manualReviewFallback(categories);
    source = 'fallback';
    errorMessage = 'AI provider not configured (GEMINI_API_KEY missing)';
  } else {
    try {
      const output = await provider.analyze({
        image: { bytes, mimeType },
        description: input.description ?? null,
        categories,
        location: { latitude: input.latitude, longitude: input.longitude, areaName: input.area_name },
      });
      result = applyRules(output, categories);
    } catch (err) {
      result = manualReviewFallback(categories);
      source = 'fallback';
      errorMessage = err instanceof Error ? err.message.slice(0, 500) : 'Unknown AI error';
    }
  }
  const latencyMs = Date.now() - started;

  // Save the analysis (also serves as the rate-limit counter and audit log).
  const { data: saved, error: saveError } = await supabase
    .from('ai_requests')
    .insert({
      user_id: user.id,
      status: source === 'gemini' ? 'success' : 'failed',
      error_message: errorMessage,
      image_path: input.image_path,
      model: provider?.name ?? null,
      latency_ms: latencyMs,
      result: source === 'gemini' ? result : null,
    })
    .select('id')
    .single();

  return {
    // A fallback result is never reusable for a report, so it gets no id.
    analysis_id: source === 'gemini' && !saveError && saved ? saved.id : null,
    source,
    model: provider?.name ?? null,
    result,
  };
}

/** Loads a successful, unused analysis owned by the user (used when creating a report). */
export async function getUsableAnalysis(userId: string, analysisId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('ai_requests')
    .select('id, user_id, report_id, status, image_path, result')
    .eq('id', analysisId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load analysis: ${error.message}`);
  if (!data || data.user_id !== userId || data.status !== 'success' || !data.result) {
    throw new AppError(400, 'INVALID_ANALYSIS', 'analysis_id is invalid');
  }
  if (data.report_id) {
    throw new AppError(409, 'ANALYSIS_ALREADY_USED', 'This analysis was already used for another report');
  }
  return { id: data.id as string, image_path: data.image_path as string | null, result: data.result as AnalysisResult };
}

export async function markAnalysisUsed(analysisId: string, reportId: string) {
  const supabase = getSupabaseAdmin();
  await supabase.from('ai_requests').update({ report_id: reportId }).eq('id', analysisId).is('report_id', null);
}
