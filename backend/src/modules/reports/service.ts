import { getSupabaseAdmin } from '../../db/client.js';
import type { AuthUser } from '../../middleware/auth.js';
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
