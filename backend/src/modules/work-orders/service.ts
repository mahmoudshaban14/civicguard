import crypto from 'node:crypto';
import { getSupabaseAdmin } from '../../db/client.js';
import type { AuthUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';
import { isDepartmentScoped, type Role } from '../../middleware/roles.js';
import { sniffImageMime } from '../analysis/service.js';
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
const MAX_EVIDENCE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Explicit role allowlists for staff operations
const MANAGER_ROLES: Role[] = ['admin', 'department_manager'];
const EMPLOYEE_ROLE: Role = 'employee';

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

function mapRpcError(error: { message?: string; code?: string }): AppError {
  const msg = error.message || '';
  const code = error.code || '';

  if (code === '23505' || /one active per report|already exists|conflict/i.test(msg)) {
    return new AppError(409, 'CONFLICT', 'An active work order already exists for this report');
  }
  if (/cannot review their own work|self/i.test(msg)) {
    return new AppError(403, 'SELF_REVIEW_BLOCKED', msg);
  }
  if (/untrusted caller|only admins or department managers|only the assigned employee|not authorized|permission denied/i.test(msg)) {
    return new AppError(403, 'FORBIDDEN', msg);
  }
  if (/not found/i.test(msg)) {
    return new AppError(404, 'NOT_FOUND', msg);
  }
  if (/required|invalid|must belong|must be in progress|status|cannot be|maximum of 5|at least one/i.test(msg)) {
    return new AppError(400, 'INVALID_REQUEST', msg);
  }
  return new AppError(500, 'DATABASE_ERROR', msg);
}

/** Lightweight visibility and existence check without fetching evidence or generating signed URLs */
async function assertCanViewWorkOrder(user: AuthUser, workOrderId: string) {
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
  const { data: wo, error } = await supabase
    .from('work_orders')
    .select('id, department_id, assigned_to, status')
    .eq('id', workOrderId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch work order: ${error.message}`);
  }
  if (!wo) {
    throw new AppError(404, 'NOT_FOUND', 'Work order not found');
  }

  checkDepartmentAccess(user, wo.department_id);

  if (user.role === EMPLOYEE_ROLE && wo.assigned_to !== user.id) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Employees can only view work orders assigned to them',
    );
  }

  return wo;
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
  if (user.role === EMPLOYEE_ROLE) {
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
  await assertCanViewWorkOrder(user, workOrderId);

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
    .single();

  if (fetchError || !wo) {
    throw new AppError(404, 'NOT_FOUND', 'Work order not found');
  }

  // Fetch associated evidence items and generate signed read URLs
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
  // Blocker 5: Uses lightweight visibility check without generating signed evidence URLs
  await assertCanViewWorkOrder(user, workOrderId);

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
  if (!MANAGER_ROLES.includes(user.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Only admins and department managers can create work orders');
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
    throw mapRpcError(error);
  }

  return { id: data as string };
}

export async function assignWorkOrder(
  user: AuthUser,
  workOrderId: string,
  input: AssignWorkOrderInput,
) {
  if (!MANAGER_ROLES.includes(user.role)) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only admins and department managers can assign work orders',
    );
  }

  const supabase = getSupabaseAdmin();

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
    throw mapRpcError(error);
  }

  return { success: true };
}

export async function startWorkOrder(user: AuthUser, workOrderId: string) {
  if (user.role !== EMPLOYEE_ROLE) {
    throw new AppError(403, 'FORBIDDEN', 'Only employees can start work orders');
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
    throw mapRpcError(error);
  }

  return { success: true };
}

export async function createEvidenceUploadUrl(
  user: AuthUser,
  workOrderId: string,
  input: SignEvidenceUploadInput,
) {
  // Blocker 2: Only employee may request an upload URL. Reject manager, admin, citizen.
  if (user.role !== EMPLOYEE_ROLE) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only employees can request an evidence upload URL',
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

  // Blocker 2: Must be the assigned employee. Reject unassigned employees.
  if (wo.assigned_to !== user.id) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only the assigned employee can upload evidence for this work order',
    );
  }

  // Blocker 2: Work order status must be in_progress. Reject all other statuses.
  if (wo.status !== 'in_progress') {
    throw new AppError(
      400,
      'INVALID_STATUS',
      `Cannot upload evidence when work order status is '${wo.status}' (must be 'in_progress')`,
    );
  }

  const ext = input.file_name.split('.').pop()?.toLowerCase() ?? 'jpg';
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
  if (user.role !== EMPLOYEE_ROLE) {
    throw new AppError(403, 'FORBIDDEN', 'Only employees can submit completion evidence');
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

  if (wo.assigned_to !== user.id) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only the assigned employee can submit completion evidence',
    );
  }

  if (wo.status !== 'in_progress') {
    throw new AppError(
      400,
      'INVALID_STATUS',
      `Work order must be in progress to submit completion (current status: '${wo.status}')`,
    );
  }

  // Blocker 3: Detect and reject duplicate paths
  const pathSet = new Set(input.after_paths);
  if (pathSet.size !== input.after_paths.length) {
    throw new AppError(
      400,
      'DUPLICATE_PATHS',
      'Duplicate evidence paths in submission are not allowed',
    );
  }

  // Blocker 3: Validate each uploaded object before calling RPC to avoid partial registration
  for (const p of input.after_paths) {
    // 1. Ensure path belongs to an authorized upload for this work order
    if (!p.startsWith(`${workOrderId}/`)) {
      throw new AppError(
        400,
        'INVALID_EVIDENCE_PATH',
        `Evidence path '${p}' does not match work order prefix '${workOrderId}/'`,
      );
    }

    // 2. Verify object exists in storage
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .download(p);

    if (downloadError || !fileBlob) {
      throw new AppError(
        400,
        'EVIDENCE_NOT_FOUND',
        `Uploaded evidence file '${p}' does not exist in storage`,
      );
    }

    // 3. Validate actual file size and type (magic bytes)
    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      throw new AppError(
        400,
        'EMPTY_FILE',
        `Evidence file '${p}' is empty`,
      );
    }

    if (buffer.length > MAX_EVIDENCE_SIZE_BYTES) {
      throw new AppError(
        400,
        'FILE_TOO_LARGE',
        `Evidence file '${p}' exceeds the 5MB size limit`,
      );
    }

    const sniffedMime = sniffImageMime(buffer);
    if (!sniffedMime || !['image/jpeg', 'image/png', 'image/webp'].includes(sniffedMime)) {
      throw new AppError(
        400,
        'INVALID_FILE_TYPE',
        `Evidence file '${p}' is not a valid JPEG, PNG, or WebP image`,
      );
    }
  }

  // All files verified; now execute atomic database transaction via RPC
  const { error } = await supabase.rpc('submit_work_order_completion', {
    p_work_order_id: workOrderId,
    p_actor: user.id,
    p_after_paths: input.after_paths,
    p_notes: input.notes ?? null,
  });

  if (error) {
    throw mapRpcError(error);
  }

  return { success: true };
}

export async function reviewWorkOrder(
  user: AuthUser,
  workOrderId: string,
  input: ReviewWorkOrderInput,
) {
  if (!MANAGER_ROLES.includes(user.role)) {
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

  // Self-review is strictly forbidden
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
    throw mapRpcError(error);
  }

  return { success: true };
}

export async function cancelWorkOrder(
  user: AuthUser,
  workOrderId: string,
  input: CancelWorkOrderInput,
) {
  if (!MANAGER_ROLES.includes(user.role)) {
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
    throw mapRpcError(error);
  }

  return { success: true };
}
