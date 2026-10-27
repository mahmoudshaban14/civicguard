import { getSupabaseAdmin } from '../../db/client.js';
import type { AuthUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';
import type { ListReportsQuery } from './schema.js';
import { getUsableAnalysis, markAnalysisUsed } from '../analysis/service.js';
import { getBoundingBox, calculateDistanceMeters } from '../../utils/geo.js';
import { runDuplicateCheck } from '../duplicates/service.js';

export async function listReports(user: AuthUser, query: ListReportsQuery) {
  const supabase = getSupabaseAdmin();

  let dbQuery = supabase
    .from('reports')
    .select(`
      id,
      report_code,
      user_id,
      category_id,
      category,
      status,
      severity,
      confidence,
      description,
      image_description,
      area_name,
      latitude,
      longitude,
      image_path,
      explanation,
      department,
      requires_manual_review,
      created_at,
      updated_at,
      resolved_at
    `)
    .order('created_at', { ascending: false })
    .range(query.offset, query.offset + query.limit - 1);

  // Scoping rules:
  // 1. If 'mine' is requested or user is a citizen -> force user's own reports
  if (query.mine || user.role === 'citizen') {
    dbQuery = dbQuery.eq('user_id', user.id);
  } else if (user.role === 'authority') {
    // 2. Department authority users see reports assigned to their department
    if (!user.department_id) {
      throw new AppError(403, 'FORBIDDEN', 'Authority user is not associated with any department');
    }
    dbQuery = dbQuery.eq('assigned_department_id', user.department_id);
  }

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status);
  }

  if (query.severity) {
    dbQuery = dbQuery.eq('severity', query.severity);
  }

  const { data, error } = await dbQuery;

  if (error) {
    throw new Error(`Failed to list reports: ${error.message}`);
  }

  return data ?? [];
}

export async function createReport(user: AuthUser, input: import('./schema.js').CreateReportInput) {
  const supabase = getSupabaseAdmin();

  // 1. Fetch category from database table 'categories' to get verified category, label, department, department_id, and default_severity
  const { data: categoryData, error: catError } = await supabase
    .from('categories')
    .select('id, label, department, department_id, default_severity')
    .eq('id', input.category_id)
    .eq('active', true)
    .maybeSingle();

  if (catError) {
    throw new Error(`Failed to verify category: ${catError.message}`);
  }

  if (!categoryData) {
    throw new AppError(400, 'INVALID_CATEGORY', `Category '${input.category_id}' not found or inactive`);
  }

  // Enforce image_path scoping: must start with <user.id>/ if provided
  if (input.image_path) {
    const expectedPrefix = `${user.id}/`;
    if (!input.image_path.startsWith(expectedPrefix)) {
      throw new AppError(
        400,
        'INVALID_IMAGE_PATH',
        `image_path must be in the authenticated user's own storage folder ('${expectedPrefix}')`,
      );
    }
  }

  // 1b. If the citizen came through AI analysis, use the server-stored result.
  // If they changed the category afterwards, the AI details no longer apply.
  const analysis = input.analysis_id ? await getUsableAnalysis(user.id, input.analysis_id) : null;
  if (analysis && input.image_path && analysis.image_path && analysis.image_path !== input.image_path) {
    throw new AppError(400, 'INVALID_ANALYSIS', 'analysis_id does not belong to this image');
  }
  const aiApplies = analysis !== null && analysis.result.category_id === categoryData.id;
  const ai = aiApplies ? analysis.result : null;

  // 2. Insert report with database-authoritative department, severity, user_id, and status
  const insertPayload = {
    user_id: user.id,
    category_id: categoryData.id,
    category: categoryData.label,
    department: categoryData.department,
    assigned_department_id: categoryData.department_id,
    severity: ai ? ai.severity : categoryData.default_severity,
    status: ai ? (ai.requires_manual_review ? 'manual_review_required' : 'ai_analyzed') : 'submitted',
    ...(ai && {
      confidence: ai.confidence,
      explanation: ai.explanation,
      image_description: ai.image_description || null,
      secondary_issues: ai.secondary_issues,
      requires_manual_review: ai.requires_manual_review,
    }),
    description: input.description ?? null,
    latitude: input.latitude,
    longitude: input.longitude,
    area_name: input.area_name ?? null,
    image_path: input.image_path ?? null,
  };

  const { data: report, error: insertError } = await supabase
    .from('reports')
    .insert(insertPayload)
    .select(`
      id,
      report_code,
      user_id,
      category_id,
      category,
      status,
      severity,
      confidence,
      description,
      image_description,
      area_name,
      latitude,
      longitude,
      image_path,
      explanation,
      department,
      assigned_department_id,
      requires_manual_review,
      created_at,
      updated_at
    `)
    .single();

  if (insertError) {
    throw new Error(`Failed to create report: ${insertError.message}`);
  }

  if (analysis) {
    await markAnalysisUsed(analysis.id, user.id, report.id);
  }

  // Duplicate detection is for admins only: it runs in the background, never
  // delays or fails the citizen's submission, and nothing is returned to the citizen.
  void (async () => {
    try {
      await runDuplicateCheck({
        id: report.id,
        category_id: report.category_id,
        latitude: report.latitude,
        longitude: report.longitude,
        image_path: report.image_path,
      });
    } catch (err) {
      console.error('[duplicates] check failed for report', report.id, err instanceof Error ? err.message : err);
    }
  })();

  return report;
}

export async function getReportById(user: AuthUser, reportId: string) {
  const supabase = getSupabaseAdmin();

  // 1. Fetch report details
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select(`
      id,
      report_code,
      user_id,
      category_id,
      category,
      status,
      severity,
      confidence,
      description,
      image_description,
      area_name,
      latitude,
      longitude,
      image_path,
      explanation,
      department,
      assigned_department_id,
      requires_manual_review,
      created_at,
      updated_at,
      resolved_at
    `)
    .eq('id', reportId)
    .maybeSingle();

  if (reportError) {
    throw new Error(`Failed to fetch report: ${reportError.message}`);
  }

  if (!report) {
    throw new AppError(404, 'NOT_FOUND', 'Report not found');
  }

  // 2. Authorization check:
  // - Citizens can only view their own reports
  // - Authorities can view reports for their assigned department
  // - Admins can view any report
  if (user.role === 'citizen' && report.user_id !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view this report');
  }

  if (
    user.role === 'authority' &&
    user.department_id &&
    report.assigned_department_id &&
    report.assigned_department_id !== user.department_id
  ) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view reports from other departments');
  }

  // 3. Fetch timeline events from report_events
  const { data: events, error: eventsError } = await supabase
    .from('report_events')
    .select(`
      id,
      report_id,
      actor_id,
      actor_role,
      old_status,
      new_status,
      note,
      created_at
    `)
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });

  if (eventsError) {
    throw new Error(`Failed to fetch report events: ${eventsError.message}`);
  }

  // 4. Generate signed image URL if image_path exists
  let signedImageUrl: string | null = null;
  if (report.image_path) {
    const { data: signedData } = await supabase.storage
      .from('report-images')
      .createSignedUrl(report.image_path, 3600);

    if (signedData?.signedUrl) {
      signedImageUrl = signedData.signedUrl;
    }
  }

  return {
    report,
    events: events ?? [],
    signedImageUrl,
  };
}

export async function getNearbyReports(query: import('./schema.js').NearbyReportsQuery) {
  const supabase = getSupabaseAdmin();

  const bbox = getBoundingBox(query.lat, query.lng, query.radius);

  // Filter with bounding box on latitude and longitude
  // Only select public fields (no reporter user_id or sensitive data)
  const { data, error } = await supabase
    .from('reports')
    .select(`
      id,
      report_code,
      category_id,
      category,
      status,
      severity,
      area_name,
      latitude,
      longitude,
      created_at
    `)
    .gte('latitude', bbox.minLat)
    .lte('latitude', bbox.maxLat)
    .gte('longitude', bbox.minLng)
    .lte('longitude', bbox.maxLng)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch nearby reports: ${error.message}`);
  }

  // Exact radius filtering using Haversine calculation and limit slice
  const nearbyReports = (data ?? [])
    .filter((rep) => {
      if (rep.latitude === null || rep.longitude === null) return false;
      const distance = calculateDistanceMeters(query.lat, query.lng, rep.latitude, rep.longitude);
      return distance <= query.radius;
    })
    .slice(0, query.limit);

  return nearbyReports;
}
