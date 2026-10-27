import { config } from '../../config.js';
import { getSupabaseAdmin } from '../../db/client.js';
import type { AuthUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';
import { calculateDistanceMeters, getBoundingBox } from '../../utils/geo.js';
import { getAiProvider } from '../analysis/provider.js';
import { sniffImageMime } from '../analysis/service.js';
import type { CompareOutput } from '../analysis/types.js';

const STORAGE_BUCKET = 'report-images';
const TABLE = 'report_duplicate_candidates';
/** Reports in these states are finished, so they are not duplicate candidates. */
const CLOSED_STATUSES = ['resolved', 'rejected', 'duplicate', 'invalid'];
const MAX_CANDIDATES = 5;
/** Each AI photo comparison is a paid Gemini call, so only the nearest few are compared. */
const MAX_AI_COMPARISONS = 3;

export interface NewReportForDuplicates {
  id: string;
  category_id: string | null;
  latitude: number | null;
  longitude: number | null;
  image_path: string | null;
}

export interface DuplicateCandidate {
  id: string;
  distance_m: number;
  image_path: string | null;
}

/** Nearby, open, same-category reports created within the time window. */
export async function findDuplicateCandidates(report: NewReportForDuplicates): Promise<DuplicateCandidate[]> {
  if (!report.category_id || report.latitude == null || report.longitude == null) return [];

  const supabase = getSupabaseAdmin();
  const box = getBoundingBox(report.latitude, report.longitude, config.DUPLICATE_RADIUS_M);
  const since = new Date(Date.now() - config.DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('reports')
    .select('id, latitude, longitude, image_path')
    .eq('category_id', report.category_id)
    .neq('id', report.id)
    .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`)
    .gte('created_at', since)
    .gte('latitude', box.minLat)
    .lte('latitude', box.maxLat)
    .gte('longitude', box.minLng)
    .lte('longitude', box.maxLng);

  if (error) throw new Error(`Failed to search duplicate candidates: ${error.message}`);

  const lat = report.latitude;
  const lng = report.longitude;
  return (data ?? [])
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => ({
      id: r.id as string,
      distance_m: Math.round(calculateDistanceMeters(lat, lng, r.latitude, r.longitude) * 10) / 10,
      image_path: (r.image_path as string | null) ?? null,
    }))
    .filter((c) => c.distance_m <= config.DUPLICATE_RADIUS_M)
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, MAX_CANDIDATES);
}

async function downloadImage(path: string | null) {
  if (!path) return null;
  const { data, error } = await getSupabaseAdmin().storage.from(STORAGE_BUCKET).download(path);
  if (error || !data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  const mimeType = sniffImageMime(bytes);
  return mimeType ? { bytes, mimeType } : null;
}

/**
 * Finds possible duplicates of a newly created report and stores them for admins.
 * Best effort: callers must not let a failure here affect the citizen.
 */
export async function runDuplicateCheck(report: NewReportForDuplicates): Promise<number> {
  const candidates = await findDuplicateCandidates(report);
  if (candidates.length === 0) return 0;

  const provider = getAiProvider();
  const canCompare = config.DUPLICATE_AI_CHECK && !!provider?.compareImages && !!report.image_path;
  const newImage = canCompare ? await downloadImage(report.image_path) : null;

  const rows = [];
  let compared = 0;
  for (const c of candidates) {
    let verdict: CompareOutput | null = null;
    if (newImage && provider?.compareImages && compared < MAX_AI_COMPARISONS) {
      const other = await downloadImage(c.image_path);
      if (other) {
        compared += 1;
        try {
          verdict = await provider.compareImages({ a: newImage, b: other, categoryLabel: report.category_id ?? 'civic issue' });
        } catch (err) {
          console.error('[duplicates] AI comparison failed:', err instanceof Error ? err.message : err);
        }
      }
    }
    rows.push({
      report_id: report.id,
      candidate_report_id: c.id,
      distance_m: c.distance_m,
      ai_checked: verdict !== null,
      ai_same_issue: verdict?.same_issue ?? null,
      ai_confidence: verdict?.confidence ?? null,
      ai_reason: verdict?.reason ?? null,
      ai_model: verdict ? (provider?.name ?? null) : null,
    });
  }

  const { error } = await getSupabaseAdmin()
    .from(TABLE)
    .upsert(rows, { onConflict: 'report_id,candidate_report_id', ignoreDuplicates: true });
  if (error) throw new Error(`Failed to save duplicate candidates: ${error.message}`);
  return rows.length;
}

/** Admin / authority view: possible duplicates of one report (both directions). */
export async function listReportDuplicates(user: AuthUser, reportId: string) {
  const supabase = getSupabaseAdmin();

  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('id, assigned_department_id')
    .eq('id', reportId)
    .maybeSingle();
  if (reportError) throw new Error(`Failed to fetch report: ${reportError.message}`);
  if (!report) throw new AppError(404, 'NOT_FOUND', 'Report not found');
  if (user.role === 'authority' && report.assigned_department_id !== user.department_id) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view reports from other departments');
  }

  const { data: links, error: linksError } = await supabase
    .from(TABLE)
    .select('id, report_id, candidate_report_id, distance_m, ai_checked, ai_same_issue, ai_confidence, ai_reason, created_at')
    .or(`report_id.eq.${reportId},candidate_report_id.eq.${reportId}`);
  if (linksError) throw new Error(`Failed to load duplicate candidates: ${linksError.message}`);
  if (!links || links.length === 0) return [];

  const otherIds = links.map((l) => (l.report_id === reportId ? l.candidate_report_id : l.report_id));
  const { data: others, error: othersError } = await supabase
    .from('reports')
    .select('id, report_code, category, status, severity, description, latitude, longitude, image_path, assigned_department_id, created_at')
    .in('id', otherIds);
  if (othersError) throw new Error(`Failed to load candidate reports: ${othersError.message}`);

  const byId = new Map((others ?? []).map((r) => [r.id as string, r]));
  const items = [];
  for (const l of links) {
    const isNewer = l.report_id === reportId; // this report is the newer one
    const other = byId.get(isNewer ? l.candidate_report_id : l.report_id);
    if (!other) continue;
    if (user.role === 'authority' && other.assigned_department_id !== user.department_id) continue;

    let imageUrl: string | null = null;
    if (other.image_path) {
      const { data: signed } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(other.image_path, 3600);
      imageUrl = signed?.signedUrl ?? null;
    }
    items.push({
      id: l.id,
      relation: isNewer ? 'earlier_report' : 'later_report',
      distance_m: Number(l.distance_m),
      ai: {
        checked: l.ai_checked === true,
        same_issue: l.ai_same_issue ?? null,
        confidence: l.ai_confidence != null ? Number(l.ai_confidence) : null,
        reason: l.ai_reason ?? null,
      },
      detected_at: l.created_at,
      report: {
        id: other.id,
        report_code: other.report_code,
        category: other.category,
        status: other.status,
        severity: other.severity,
        description: other.description,
        latitude: other.latitude,
        longitude: other.longitude,
        created_at: other.created_at,
        image_url: imageUrl,
      },
    });
  }

  // Most likely duplicates first: AI says same issue, then nearest.
  items.sort((a, b) => Number(b.ai.same_issue === true) - Number(a.ai.same_issue === true) || a.distance_m - b.distance_m);
  return items;
}
