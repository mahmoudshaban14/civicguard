import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as clientModule from '../src/db/client.js';

const WO_ID = '11111111-2222-4333-8444-555555555555';
const REPORT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const DEPT_A = '10000000-0000-4000-8000-000000000001';
const DEPT_B = '20000000-0000-4000-8000-000000000002';
const EMP_A = '30000000-0000-4000-8000-000000000001';
const EMP_A2 = '30000000-0000-4000-8000-000000000002';
const MGR_A = '40000000-0000-4000-8000-000000000001';
const ADMIN = '50000000-0000-4000-8000-000000000001';
const CITIZEN = '60000000-0000-4000-8000-000000000001';

interface Opts {
  callerId: string;
  role: string;
  dept: string | null;
  woDept?: string;
  assignedTo?: string | null;
  reportDept?: string | null;
}

function setup(o: Opts) {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const wo = {
    id: WO_ID,
    report_id: REPORT_ID,
    department_id: o.woDept ?? DEPT_A,
    assigned_to: o.assignedTo === undefined ? EMP_A : o.assignedTo,
    status: 'pending_verification',
  };
  const builder = (data: unknown) => {
    const b: Record<string, unknown> = {};
    b.select = vi.fn().mockReturnValue(b);
    b.eq = vi.fn().mockReturnValue(b);
    b.order = vi.fn().mockReturnValue(b);
    b.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
    b.single = vi.fn().mockResolvedValue({ data, error: null });
    b.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
    return b;
  };
  vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: o.callerId } }, error: null }) },
    from: vi.fn((t: string) => {
      if (t === 'profiles')
        return builder({ id: o.callerId, role: o.role, department_id: o.dept, full_name: 'X', is_active: true });
      if (t === 'work_orders') return builder(wo);
      if (t === 'reports')
        return builder({
          id: REPORT_ID,
          user_id: CITIZEN,
          status: 'assigned',
          assigned_department_id: o.reportDept === undefined ? DEPT_B : o.reportDept,
        });
      return builder(null);
    }),
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return { data: WO_ID, error: null };
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient);
  return rpcCalls;
}

const auth = (r: request.Test) => r.set('Authorization', 'Bearer t');
const post = (path: string, body: object = {}) => auth(request(app).post(`/v1/work-orders${path}`)).send(body);

afterEach(() => vi.restoreAllMocks());

describe('Work Orders authorization (no RPC is reached on denial)', () => {
  it('manager of dept A cannot review a work order of dept B', async () => {
    const rpc = setup({ callerId: MGR_A, role: 'department_manager', dept: DEPT_A, woDept: DEPT_B });
    const res = await post(`/${WO_ID}/review`, { decision: 'approved' });
    expect(res.status).toBe(403);
    expect(rpc).toHaveLength(0);
  });

  it('manager of dept A cannot assign, start or cancel a work order of dept B', async () => {
    const rpc = setup({ callerId: MGR_A, role: 'department_manager', dept: DEPT_A, woDept: DEPT_B });
    expect((await post(`/${WO_ID}/assign`, { assigned_to: EMP_A })).status).toBe(403);
    expect((await post(`/${WO_ID}/start`)).status).toBe(403);
    expect((await post(`/${WO_ID}/cancel`, { reason: 'Not needed anymore' })).status).toBe(403);
    expect(rpc).toHaveLength(0);
  });

  it('an employee cannot approve the repair they executed themselves', async () => {
    const rpc = setup({ callerId: EMP_A, role: 'employee', dept: DEPT_A, assignedTo: EMP_A });
    const res = await post(`/${WO_ID}/review`, { decision: 'approved' });
    expect(res.status).toBe(403);
    expect(rpc).toHaveLength(0);
  });

  it('an employee cannot review a colleague\'s work either (reviewing is manager/admin only)', async () => {
    const rpc = setup({ callerId: EMP_A2, role: 'employee', dept: DEPT_A, assignedTo: EMP_A });
    const res = await post(`/${WO_ID}/review`, { decision: 'approved' });
    expect(res.status).toBe(403);
    expect(rpc).toHaveLength(0);
  });

  it('a manager who is the assignee cannot approve their own work', async () => {
    const rpc = setup({ callerId: MGR_A, role: 'department_manager', dept: DEPT_A, assignedTo: MGR_A });
    expect((await post(`/${WO_ID}/review`, { decision: 'approved' })).status).toBe(403);
    expect(rpc).toHaveLength(0);
  });

  it('a citizen cannot run any work order operation', async () => {
    const rpc = setup({ callerId: CITIZEN, role: 'citizen', dept: null });
    const calls = [
      post('', { report_id: REPORT_ID, department_id: DEPT_A, title: 't', priority: 'High' }),
      post(`/${WO_ID}/assign`, { assigned_to: EMP_A }),
      post(`/${WO_ID}/start`),
      post(`/${WO_ID}/review`, { decision: 'approved' }),
      post(`/${WO_ID}/cancel`, { reason: 'Not needed anymore' }),
      post(`/${WO_ID}/evidence/sign`, { content_type: 'image/jpeg' }),
    ];
    for (const c of await Promise.all(calls)) expect([400, 403]).toContain(c.status);
    expect(rpc).toHaveLength(0);
  });

  it('an employee without a department gets 403 on every work order operation', async () => {
    const rpc = setup({ callerId: EMP_A, role: 'employee', dept: null });
    expect((await post(`/${WO_ID}/start`)).status).toBe(403);
    expect((await post(`/${WO_ID}/review`, { decision: 'approved' })).status).toBe(403);
    expect(rpc).toHaveLength(0);
  });

  it('admin can review and cancel work orders of any department', async () => {
    const rpc = setup({ callerId: ADMIN, role: 'admin', dept: null, woDept: DEPT_B });
    expect((await post(`/${WO_ID}/review`, { decision: 'approved', note: 'ok' })).status).toBe(200);
    expect((await post(`/${WO_ID}/cancel`, { reason: 'duplicate' })).status).toBe(200);
    expect(rpc.map((c) => c.fn)).toEqual(['review_work_order', 'cancel_work_order']);
    expect(rpc.every((c) => c.args.p_actor === ADMIN)).toBe(true);
  });

  it('identity in the request body is never used: the RPC actor is always the JWT user', async () => {
    const rpc = setup({ callerId: MGR_A, role: 'department_manager', dept: DEPT_A, assignedTo: EMP_A });
    await post(`/${WO_ID}/review`, { decision: 'approved', p_actor: ADMIN, actor_id: ADMIN, role: 'admin' });
    expect(rpc.every((c) => c.args.p_actor === MGR_A)).toBe(true);
  });
});

describe('Report access isolation for employees', () => {
  it('an employee of dept A cannot read a report assigned to dept B by id', async () => {
    setup({ callerId: EMP_A, role: 'employee', dept: DEPT_A, reportDept: DEPT_B });
    const res = await auth(request(app).get(`/v1/reports/${REPORT_ID}`));
    expect(res.status).toBe(403);
  });

  it('an employee cannot read a report with no department assigned', async () => {
    setup({ callerId: EMP_A, role: 'employee', dept: DEPT_A, reportDept: null });
    expect((await auth(request(app).get(`/v1/reports/${REPORT_ID}`))).status).toBe(403);
  });

  it('an employee of dept A cannot list duplicates of a dept B report', async () => {
    setup({ callerId: EMP_A, role: 'employee', dept: DEPT_A, reportDept: DEPT_B });
    const res = await auth(request(app).get(`/v1/authority/reports/${REPORT_ID}/duplicates`));
    expect(res.status).toBe(403);
  });
});
