import { getSupabaseAdmin } from '../../db/client.js';
import type { AuthUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';
import type { ListReportsQuery } from './schema.js';

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
  } else if (user.role === 'authority' && user.department_id) {
    // 2. Department authority users see reports assigned to their department
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

  // 2. Insert report with database-authoritative department, severity, user_id, and status 'submitted'
  const insertPayload = {
    user_id: user.id,
    category_id: categoryData.id,
    category: categoryData.label,
    department: categoryData.department,
    assigned_department_id: categoryData.department_id,
    severity: categoryData.default_severity,
    status: 'submitted',
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

  return report;
}
