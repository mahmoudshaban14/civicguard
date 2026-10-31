import crypto from 'node:crypto';
import { getSupabaseAdmin } from '../../db/client.js';
import type { AuthUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';
import { isDepartmentScoped } from '../../middleware/roles.js';
import type {
  ListWorkOrdersQuery,
  CreateWorkOrderInput,
  AssignWorkOrderInput,
  SubmitWorkOrderCompletionInput,
  SignEvidenceUploadInput,
  ReviewWorkOrderInput,
  CancelWorkOrderInput,
} from './schema.js';

const EVIDENCE_BUCKET = 'work-order-evidence';

function checkDepartmentAccess(user: AuthUser, departmentId: string) {
  if (user.role === 'admin') return;
  if (!user.department_id) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Department staff user is not associated with any department',
    );
  }
  if (user.department_id !== departmentId) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'You do not have access to work orders in another department',
    );
  }
}

export async function listWorkOrders(user: AuthUser, query: ListWorkOrdersQuery) {
  if (user.role === 'citizen') {
    throw new AppError(403, 'FORBIDDEN', 'Citizens cannot view work orders');
  }

  if (isDepartmentScoped(user.role) && !user.department_id) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Department staff user is not associated with any department',
    );
  }

  const supabase = getSupabaseAdmin();
  let dbQuery = supabase
    .from('work_orders')
    .select(`
      id,
      wo_code,
      report_id,
      department_id,
      assigned_to,
      title,
      description,
      priority,
      status,
      target_completion_at,
      started_at,
      completed_at,
      cancellation_reason,
      delay_reason,
      last_review_decision,
      reviewed_by,
      reviewed_at,
      review_note,
      created_by,
      created_at,
      updated_at
    `)
    .order('created_at', { ascending: false })
    .range(query.offset, query.offset + query.limit - 1);

  // Department and role scoping:
  // - Employee: only work orders assigned to them within their department
  // - Department Manager: all work orders within their department
  // - Admin: all work orders (optional department filter)
  if (user.role === 'employee') {
    dbQuery = dbQuery
      .eq('department_id', user.department_id as string)
      .eq('assigned_to', user.id);
  } else if (user.role === 'department_manager') {
    dbQuery = dbQuery.eq('department_id', user.department_id as string);
    if (query.assigned_to) {
      dbQuery = dbQuery.eq('assigned_to', query.assigned_to);
    }
  } else if (user.role === 'admin') {
    if (query.department_id) {
      dbQuery = dbQuery.eq('department_id', query.department_id);
    }
    if (query.assigned_to) {
      dbQuery = dbQuery.eq('assigned_to', query.assigned_to);
    }
  }

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status);
  }
  if (query.priority) {
    dbQuery = dbQuery.eq('priority', query.priority);
  }

  const { data, error } = await dbQuery;
  if (error) {
    throw new Error(`Failed to list work orders: ${error.message}`);
  }

  return data ?? [];
}

export async function getWorkOrderById(user: AuthUser, workOrderId: string) {
  if (user.role === 'citizen') {
    throw new AppError(403, 'FORBIDDEN', 'Citizens cannot view work orders');
  }

  const supabase = getSupabaseAdmin();

  const { data: wo, error: fetchError } = await supabase
    .from('work_orders')
    .select(`
      id,
      wo_code,
      report_id,
      department_id,
      assigned_to,
      title,
      description,
      priority,
      status,
      target_completion_at,
      started_at,
      completed_at,
      cancellation_reason,
      delay_reason,
      last_review_decision,
      reviewed_by,
      reviewed_at,
      review_note,
      created_by,
      created_at,
      updated_at
    `)
    .eq('id', workOrderId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch work order: ${fetchError.message}`);
  }

  if (!wo) {
    throw new AppError(404, 'NOT_FOUND', 'Work order not found');
  }

  checkDepartmentAccess(user, wo.department_id);

  if (user.role === 'employee' && wo.assigned_to !== user.id) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Employees can only view work orders assigned to them',
    );
  }

  // Fetch associated evidence items
  const { data: evidenceRows, error: evidenceError } = await supabase
    .from('work_order_evidence')
    .select('id, work_order_id, kind, storage_path, notes, uploaded_by, uploaded_at')
    .eq('work_order_id', workOrderId)
    .order('uploaded_at', { ascending: true });

  if (evidenceError) {
    throw new Error(`Failed to fetch work order evidence: ${evidenceError.message}`);
  }

  const evidence = [];
  for (const item of evidenceRows ?? []) {
    let signedUrl: string | null = null;
    if (item.storage_path) {
      const { data: signed } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(item.storage_path, 3600);
      signedUrl = signed?.signedUrl ?? null;
    }
    evidence.push({
      ...item,
      url: signedUrl,
    });
  }

  return {
    ...wo,
    evidence,
  };
}

export async function getWorkOrderEvents(user: AuthUser, workOrderId: string) {
  // Same visibility check as viewing the work order
  await getWorkOrderById(user, workOrderId);

  const supabase = getSupabaseAdmin();
  const { data: events, error } = await supabase
    .from('work_order_updates')
    .select(`
      id,
      work_order_id,
      action,
      old_status,
      new_status,
      old_assigned_to,
      new_assigned_to,
      actor_id,
      actor_role,
      note,
      created_at
    `)
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch work order events: ${error.message}`);
  }

  return events ?? [];
}

export async function createWorkOrder(user: AuthUser, input: CreateWorkOrderInput) {
  if (user.role === 'citizen') {
    throw new AppError(403, 'FORBIDDEN', 'Citizens cannot create work orders');
  }
  if (user.role === 'employee') {
    throw new AppError(403, 'FORBIDDEN', 'Employees cannot create work orders');
  }
  checkDepartmentAccess(user, input.department_id);

  const supabase = getSupabaseAdmin();

  // Execute the secure RPC using service_role credentials
  const { data, error } = await supabase.rpc('create_work_order', {
    p_report_id: input.report_id,
    p_department_id: input.department_id,
    p_title: input.title,
    p_description: input.description ?? null,
    p_priority: input.priority,
    p_target_at: input.target_completion_at ?? null,
    p_assigned_to: input.assigned_to ?? null,
    p_actor: user.id,
  });

  if (error) {
    const msg = error.message;
    if (/not found|required|match|invalid|must belong/i.test(msg)) {
      throw new AppError(400, 'INVALID_WORK_ORDER', msg);
    }
    if (/unauthorized|only admins or department managers/i.test(msg)) {
      throw new AppError(403, 'FORBIDDEN', msg);
    }
    throw new Error(`Failed to create work order: ${msg}`);
  }

  return { id: data as string };
}

export async function assignWorkOrder(
  user: AuthUser,
  workOrderId: string,
  input: AssignWorkOrderInput,
) {
  if (user.role === 'citizen' || user.role === 'employee') {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only admins and department managers can assign work orders',
    );
  }

  const supabase = getSupabaseAdmin();

  // Verify work order department access before calling RPC
  const { data: wo, error: fetchError } = await supabase
    .from('work_orders')
    .select('department_id')
    .eq('id', workOrderId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch work order: ${fetchError.message}`);
  }
  if (!wo) {
    throw new AppError(404, 'NOT_FOUND', 'Work order not found');
  }
  checkDepartmentAccess(user, wo.department_id);

  const { error } = await supabase.rpc('assign_work_order', {
    p_work_order_id: workOrderId,
    p_assigned_to: input.assigned_to,
    p_actor: user.id,
    p_note: input.note ?? null,
  });

  if (error) {
    const msg = error.message;
    if (/not found/i.test(msg)) {
      throw new AppError(404, 'NOT_FOUND', msg);
    }
    if (/must belong|status|cannot be assigned/i.test(msg)) {
      throw new AppError(400, 'INVALID_ASSIGNMENT', msg);
    }
    if (/unauthorized|only admins or department managers/i.test(msg)) {
      throw new AppError(403, 'FORBIDDEN', msg);
    }
    throw new Error(`Failed to assign work order: ${msg}`);
  }

  return { success: true };
}

export async function startWorkOrder(user: AuthUser, workOrderId: string) {
  const supabase = getSupabaseAdmin();

  const { data: wo, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, assigned_to, department_id, status')
    .eq('id', workOrderId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch work order: ${fetchError.message}`);
  }
  if (!wo) {
    throw new AppError(404, 'NOT_FOUND', 'Work order not found');
  }

  checkDepartmentAccess(user, wo.department_id);

  if (wo.assigned_to !== user.id) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only the assigned employee can start this work order',
    );
  }

  const { error } = await supabase.rpc('start_work_order', {
    p_work_order_id: workOrderId,
    p_actor: user.id,
  });

  if (error) {
    const msg = error.message;
    if (/assigned status/i.test(msg)) {
      throw new AppError(400, 'INVALID_STATUS', msg);
    }
    if (/only the assigned employee/i.test(msg)) {
      throw new AppError(403, 'FORBIDDEN', msg);
    }
    throw new Error(`Failed to start work order: ${msg}`);
  }

  return { success: true };
}

export async function createEvidenceUploadUrl(
  user: AuthUser,
  workOrderId: string,
  input: SignEvidenceUploadInput,
) {
  const supabase = getSupabaseAdmin();

  const { data: wo, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, assigned_to, department_id, status')
    .eq('id', workOrderId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch work order: ${fetchError.message}`);
  }
  if (!wo) {
    throw new AppError(404, 'NOT_FOUND', 'Work order not found');
  }

  checkDepartmentAccess(user, wo.department_id);

  if (user.role === 'employee' && wo.assigned_to !== user.id) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only the assigned employee can upload evidence for this work order',
    );
  }

  const ext = input.file_name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const cleanName = input.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${workOrderId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    throw new Error(`Failed to create evidence upload URL: ${error?.message}`);
  }

  return {
    storage_path: storagePath,
    token: data.token,
    url: data.signedUrl,
  };
}

export async function submitWorkOrderCompletion(
  user: AuthUser,
  workOrderId: string,
  input: SubmitWorkOrderCompletionInput,
) {
  const supabase = getSupabaseAdmin();

  const { data: wo, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, assigned_to, department_id, status')
    .eq('id', workOrderId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch work order: ${fetchError.message}`);
  }
  if (!wo) {
    throw new AppError(404, 'NOT_FOUND', 'Work order not found');
  }

  checkDepartmentAccess(user, wo.department_id);

  if (wo.assigned_to !== user.id) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only the assigned employee can submit completion evidence',
    );
  }

  // Ensure all storage paths belong to this work order
  for (const p of input.after_paths) {
    if (!p.startsWith(`${workOrderId}/`)) {
      throw new AppError(
        400,
        'INVALID_EVIDENCE_PATH',
        `Evidence path '${p}' does not match work order prefix '${workOrderId}/'`,
      );
    }
  }

  const { error } = await supabase.rpc('submit_work_order_completion', {
    p_work_order_id: workOrderId,
    p_actor: user.id,
    p_after_paths: input.after_paths,
    p_notes: input.notes ?? null,
  });

  if (error) {
    const msg = error.message;
    if (/must be in progress|maximum of 5|at least one/i.test(msg)) {
      throw new AppError(400, 'INVALID_SUBMISSION', msg);
    }
    if (/only the assigned employee/i.test(msg)) {
      throw new AppError(403, 'FORBIDDEN', msg);
    }
    throw new Error(`Failed to submit work order completion: ${msg}`);
  }

  return { success: true };
}

export async function reviewWorkOrder(
  user: AuthUser,
  workOrderId: string,
  input: ReviewWorkOrderInput,
) {
  if (user.role === 'citizen' || user.role === 'employee') {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only admins and department managers can review work orders',
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: wo, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, assigned_to, department_id, status')
    .eq('id', workOrderId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch work order: ${fetchError.message}`);
  }
  if (!wo) {
    throw new AppError(404, 'NOT_FOUND', 'Work order not found');
  }

  checkDepartmentAccess(user, wo.department_id);

  // Self-review is strictly forbidden: assignee cannot review their own work
  if (wo.assigned_to === user.id) {
    throw new AppError(
      403,
      'SELF_REVIEW_BLOCKED',
      'Assigned employee cannot review their own work order',
    );
  }

  const { error } = await supabase.rpc('review_work_order', {
    p_work_order_id: workOrderId,
    p_actor: user.id,
    p_decision: input.decision,
    p_note: input.note ?? '',
  });

  if (error) {
    const msg = error.message;
    if (/cannot review their own work/i.test(msg)) {
      throw new AppError(403, 'SELF_REVIEW_BLOCKED', msg);
    }
    if (/not awaiting verification|note is required|decision must be/i.test(msg)) {
      throw new AppError(400, 'INVALID_REVIEW', msg);
    }
    throw new Error(`Failed to review work order: ${msg}`);
  }

  return { success: true };
}

export async function cancelWorkOrder(
  user: AuthUser,
  workOrderId: string,
  input: CancelWorkOrderInput,
) {
  if (user.role === 'citizen' || user.role === 'employee') {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only admins and department managers can cancel work orders',
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: wo, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, department_id, status')
    .eq('id', workOrderId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch work order: ${fetchError.message}`);
  }
  if (!wo) {
    throw new AppError(404, 'NOT_FOUND', 'Work order not found');
  }

  checkDepartmentAccess(user, wo.department_id);

  const { error } = await supabase.rpc('cancel_work_order', {
    p_work_order_id: workOrderId,
    p_actor: user.id,
    p_reason: input.reason,
  });

  if (error) {
    const msg = error.message;
    if (/cannot be cancelled|reason is required/i.test(msg)) {
      throw new AppError(400, 'INVALID_CANCELLATION', msg);
    }
    throw new Error(`Failed to cancel work order: ${msg}`);
  }

  return { success: true };
}

