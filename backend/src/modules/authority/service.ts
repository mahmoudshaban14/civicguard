
import { getSupabaseAdmin } from '../../db/client.js';
import type { AuthUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';
import type {
  AuthorityReportsQuery,
  UpdateReportStatusInput,
  AssignReportDepartmentInput,
  UpdateReportActionStatusInput,
} from './schema.js';

// Allowed workflow transitions per docs/backend-design.md
const VALID_TRANSITIONS: Record<string, string[]> = {
  submitted: ['ai_analyzed', 'assigned', 'manual_review_required', 'rejected', 'invalid', 'duplicate'],
  ai_analyzed: ['assigned', 'manual_review_required', 'rejected', 'invalid', 'duplicate'],
  manual_review_required: ['assigned', 'rejected', 'invalid', 'duplicate'],
  assigned: ['under_review', 'in_progress', 'escalated', 'rejected', 'duplicate'],
  under_review: ['in_progress', 'assigned', 'resolved', 'escalated', 'rejected', 'duplicate'],
  in_progress: ['resolved', 'under_review', 'escalated', 'rejected'],
  escalated: ['in_progress', 'resolved', 'rejected'],
  resolved: [],
  rejected: [],
  duplicate: [],
  invalid: [],
};

export async function listAuthorityReports(
  user: AuthUser,
  query: AuthorityReportsQuery,
) {
  const supabase = getSupabaseAdmin();

  // Safe defaults when pagination parameters are missing
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  let dbQuery = supabase
    .from('reports')
    .select(`
      id,
      report_code,
      user_id,
      category,
      status,
      severity,
      confidence,
      description,
      image_description,
      latitude,
      longitude,
      image_path,
      explanation,
      department,
      requires_manual_review,
      created_at,
      updated_at
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Department scoping: authority users are scoped to their department
  if (user.role === 'authority') {
    if (!user.department_id) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Authority user is not associated with any department',
      );
    }

    dbQuery = dbQuery.eq('assigned_department_id', user.department_id);
  } else if (user.role === 'admin' && query.department_id) {
    dbQuery = dbQuery.eq('assigned_department_id', query.department_id);
  }

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status);
  }

  if (query.severity) {
    dbQuery = dbQuery.eq('severity', query.severity);
  }

  const { data, error } = await dbQuery;

  if (error) {
    throw new Error(`Failed to list authority reports: ${error.message}`);
  }

  return data ?? [];
}

export async function updateReportStatus(
  user: AuthUser,
  reportId: string,
  input: UpdateReportStatusInput,
) {
  const supabase = getSupabaseAdmin();

  // 1. Fetch current report
  const { data: report, error: fetchError } = await supabase
    .from('reports')
    .select('id, status, assigned_department_id, user_id, report_code')
    .eq('id', reportId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch report: ${fetchError.message}`);
  }

  if (!report) {
    throw new AppError(404, 'NOT_FOUND', 'Report not found');
  }

  // 2. Department authority scoping
  if (
    user.role === 'authority' &&
    report.assigned_department_id !== user.department_id
  ) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Authority users can only update reports in their assigned department',
    );
  }

  // 3. Status transition check
  if (report.status !== input.status) {
    const allowed = VALID_TRANSITIONS[report.status] || [];

    // Admins can override; authorities must follow state transitions
    if (user.role !== 'admin' && !allowed.includes(input.status)) {
      throw new AppError(
        400,
        'INVALID_STATUS_TRANSITION',
        `Cannot transition report from status '${report.status}' to '${input.status}'`,
      );
    }
  }

  // 3b. Linking a duplicate: the target must be a different, existing report
  if (input.duplicate_of) {
    if (input.status !== 'duplicate') {
      throw new AppError(400, 'INVALID_REQUEST', "duplicate_of can only be used with status 'duplicate'");
    }
    if (input.duplicate_of === reportId) {
      throw new AppError(400, 'INVALID_REQUEST', 'A report cannot be a duplicate of itself');
    }
    const { data: target, error: targetError } = await supabase
      .from('reports')
      .select('id, assigned_department_id')
      .eq('id', input.duplicate_of)
      .maybeSingle();
    if (targetError) {
      throw new Error(`Failed to verify duplicate target: ${targetError.message}`);
    }
    if (
      !target ||
      (user.role === 'authority' && target.assigned_department_id !== user.department_id)
    ) {
      throw new AppError(404, 'NOT_FOUND', 'Duplicate target report not found');
    }
  }

  // 4. Update status in database
  const updatePayload: Record<string, unknown> = {
    status: input.status,
    status_changed_by: user.id,
    updated_by: user.id,
    status_note: input.note ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.status === 'duplicate' && input.duplicate_of) {
    updatePayload.duplicate_of = input.duplicate_of;
  }

  const { data: updatedReport, error: updateError } = await supabase
    .from('reports')
    .update(updatePayload)
    .eq('id', reportId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update report status: ${updateError.message}`);
  }

  // The database trigger handles report events and notifications.
  return updatedReport;
}

export async function assignReportDepartment(
  user: AuthUser,
  reportId: string,
  input: AssignReportDepartmentInput,
) {
  const supabase = getSupabaseAdmin();

  // 1. Fetch department details
  const { data: dept, error: deptError } = await supabase
    .from('departments')
    .select('id, name')
    .eq('id', input.department_id)
    .maybeSingle();

  if (deptError) {
    throw new Error(`Failed to fetch department: ${deptError.message}`);
  }

  if (!dept) {
    throw new AppError(
      404,
      'NOT_FOUND',
      `Department with id '${input.department_id}' not found`,
    );
  }

  // 2. Fetch report
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('id, status, assigned_department_id')
    .eq('id', reportId)
    .maybeSingle();

  if (reportError) {
    throw new Error(`Failed to fetch report: ${reportError.message}`);
  }

  if (!report) {
    throw new AppError(404, 'NOT_FOUND', 'Report not found');
  }

  // 3. Department scoping check for authority users
  if (user.role === 'authority') {
    if (!user.department_id) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Authority user is not associated with any department',
      );
    }

    if (report.assigned_department_id !== user.department_id) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Authority users can only reassign reports currently assigned to their own department',
      );
    }
  }

  // 4. Update department on report
  const { data: updatedReport, error: updateError } = await supabase
    .from('reports')
    .update({
      assigned_department_id: dept.id,
      department: dept.name,
      status:
        report.status === 'manual_review_required'
          ? 'assigned'
          : report.status,
      status_changed_by: user.id,
      updated_by: user.id,
      status_note: input.note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to assign report department: ${updateError.message}`);
  }

  return updatedReport;
}

export async function updateReportActionStatus(
  user: AuthUser,
  reportId: string,
  input: UpdateReportActionStatusInput,
) {
  const supabase = getSupabaseAdmin();

  // 1. Fetch current report
  const { data: report, error: fetchError } = await supabase
    .from('reports')
    .select('id, assigned_department_id')
    .eq('id', reportId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch report: ${fetchError.message}`);
  }

  if (!report) {
    throw new AppError(404, 'NOT_FOUND', 'Report not found');
  }

  // 2. Department authority scoping
  if (user.role === 'authority' && report.assigned_department_id !== user.department_id) {
    throw new AppError(403, 'FORBIDDEN', 'Authority users can only update reports in their assigned department');
  }

  // 3. Update action_status with getSupabaseAdmin() and set updated_by = user.id
  const { data: updatedReport, error: updateError } = await supabase
    .from('reports')
    .update({
      action_status: input.action_status,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update report action status: ${updateError.message}`);
  }

  return updatedReport;
}

