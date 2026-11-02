import { getSupabaseAdmin } from '../../db/client.js';
import { AppError } from '../../middleware/error-handler.js';
import type { AuthUser } from '../../middleware/auth.js';
import type {
  ListWorkOrdersQuery,
  CreateWorkOrderInput,
  AssignWorkOrderInput,
  SubmitCompletionInput,
  ReviewWorkOrderInput,
  CancelWorkOrderInput,
} from './schema.js';

const supabase = () => getSupabaseAdmin();

function requireManager(user: AuthUser) {
  if (!['admin', 'department_manager'].includes(user.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Manager or admin access required');
  }
}

function requireEmployee(user: AuthUser) {
  if (user.role !== 'employee') {
    throw new AppError(403, 'FORBIDDEN', 'Employee access required');
  }
  if (!user.department_id) {
    throw new AppError(403, 'FORBIDDEN', 'Your account has no assigned department');
  }
}

function checkDepartment(user: AuthUser, departmentId: string) {
  if (user.role === 'department_manager' && user.department_id !== departmentId) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot access another department');
  }
}

async function runRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(name, args);

  if (error) {
    throw new AppError(400, 'WORK_ORDER_ERROR', error.message);
  }

  return data as T;
}

export async function listWorkOrders(
  user: AuthUser,
  query: ListWorkOrdersQuery,
) {
  if (!['admin', 'department_manager', 'employee'].includes(user.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  if (user.role === 'employee') requireEmployee(user);
  if (user.role === 'department_manager' && !user.department_id) {
    throw new AppError(403, 'FORBIDDEN', 'Your account has no assigned department');
  }

  const page = query.page;
  const limit = query.limit;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let request = supabase()
    .from('work_orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (user.role === 'employee') {
    request = request.eq('assigned_to', user.id);
  } else if (user.role === 'department_manager') {
    request = request.eq('department_id', user.department_id!);
  }

  if (query.status) request = request.eq('status', query.status);
  if (query.mine === '1' && user.role !== 'employee') {
    request = request.eq('created_by', user.id);
  }

  const { data, error, count } = await request;

  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', error.message);
  }

  return {
    workOrders: data ?? [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  };
}

export async function createWorkOrder(user: AuthUser, input: CreateWorkOrderInput) {
  requireManager(user);
  checkDepartment(user, input.departmentId);

  return runRpc<string>('create_work_order', {
    p_report_id: input.reportId,
    p_department_id: input.departmentId,
    p_title: input.title,
    p_description: input.description ?? null,
    p_priority: input.priority,
    p_target_at: input.targetAt ?? null,
    p_assigned_to: input.assignedTo ?? null,
    p_actor: user.id,
  });
}

export async function assignWorkOrder(
  user: AuthUser,
  workOrderId: string,
  input: AssignWorkOrderInput,
) {
  requireManager(user);

  const { data: workOrder, error } = await supabase()
    .from('work_orders')
    .select('department_id')
    .eq('id', workOrderId)
    .single();

  if (error || !workOrder) {
    throw new AppError(404, 'NOT_FOUND', 'Work Order not found');
  }

  checkDepartment(user, workOrder.department_id);

  return runRpc('assign_work_order', {
    p_work_order_id: workOrderId,
    p_assigned_to: input.assignedTo,
    p_actor: user.id,
    p_note: input.note ?? null,
  });
}

export async function startWorkOrder(user: AuthUser, workOrderId: string) {
  requireEmployee(user);

  return runRpc('start_work_order', {
    p_work_order_id: workOrderId,
    p_actor: user.id,
  });
}

export async function submitCompletion(
  user: AuthUser,
  workOrderId: string,
  input: SubmitCompletionInput,
) {
  requireEmployee(user);

  return runRpc('submit_work_order_completion', {
    p_work_order_id: workOrderId,
    p_actor: user.id,
    p_after_paths: input.afterPaths,
    p_notes: input.notes ?? null,
  });
}

export async function reviewWorkOrder(
  user: AuthUser,
  workOrderId: string,
  input: ReviewWorkOrderInput,
) {
  requireManager(user);

  return runRpc('review_work_order', {
    p_work_order_id: workOrderId,
    p_actor: user.id,
    p_decision: input.decision,
    p_note: input.note ?? '',
  });
}

export async function cancelWorkOrder(
  user: AuthUser,
  workOrderId: string,
  input: CancelWorkOrderInput,
) {
  requireManager(user);

  const { data: workOrder, error } = await supabase()
    .from('work_orders')
    .select('department_id')
    .eq('id', workOrderId)
    .single();

  if (error || !workOrder) {
    throw new AppError(404, 'NOT_FOUND', 'Work Order not found');
  }

  checkDepartment(user, workOrder.department_id);

  return runRpc('cancel_work_order', {
    p_work_order_id: workOrderId,
    p_actor: user.id,
    p_reason: input.reason,
  });
}