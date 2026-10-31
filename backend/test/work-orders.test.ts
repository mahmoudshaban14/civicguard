import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as clientModule from '../src/db/client.js';

const WO_ID = '11111111-2222-4333-8444-555555555555';
const REPORT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const DEPT_MINE = '10000000-0000-4000-8000-000000000001';
const DEPT_OTHER = '20000000-0000-4000-8000-000000000002';
const USER_EMP = '30000000-0000-4000-8000-000000000001';
const USER_OTHER_EMP = '30000000-0000-4000-8000-000000000002';
const USER_MGR = '40000000-0000-4000-8000-000000000001';
const USER_ADMIN = '50000000-0000-4000-8000-000000000001';

interface MockWoOptions {
  callerId?: string;
  callerRole: string;
  callerDept?: string | null;
  woDept?: string;
  woAssignedTo?: string | null;
  woStatus?: string;
  rpcResult?: { data: unknown; error: unknown };
}

function mockSupabase(opts: MockWoOptions) {
  const callerId = opts.callerId ?? '00000000-0000-4000-8000-000000000099';
  const woDept = opts.woDept ?? DEPT_MINE;
  const woAssignedTo = opts.woAssignedTo ?? USER_EMP;
  const woStatus = opts.woStatus ?? 'assigned';

  const rpcCalls: { fn: string; args: unknown }[] = [];

  const singleWo = {
    id: WO_ID,
    wo_code: 'WO-2026-0001',
    report_id: REPORT_ID,
    department_id: woDept,
    assigned_to: woAssignedTo,
    title: 'Fix pothole',
    priority: 'High',
    status: woStatus,
  };

  const woQueryBuilder: Record<string, unknown> = {};
  woQueryBuilder.select = vi.fn().mockReturnValue(woQueryBuilder);
  woQueryBuilder.order = vi.fn().mockReturnValue(woQueryBuilder);
  woQueryBuilder.range = vi.fn().mockReturnValue(woQueryBuilder);
  woQueryBuilder.eq = vi.fn().mockReturnValue(woQueryBuilder);
  woQueryBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: singleWo, error: null });
  woQueryBuilder.single = vi.fn().mockResolvedValue({ data: singleWo, error: null });
  woQueryBuilder.then = (resolve: (val: unknown) => void) =>
    resolve({ data: [singleWo], error: null });

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: callerId } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: callerId,
              role: opts.callerRole,
              department_id: opts.callerDept !== undefined ? opts.callerDept : DEPT_MINE,
              full_name: 'Caller Name',
            },
            error: null,
          }),
        };
      }
      if (table === 'work_orders') {
        return woQueryBuilder;
      }
      if (table === 'work_order_evidence') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'ev-1',
                work_order_id: WO_ID,
                kind: 'after',
                storage_path: `${WO_ID}/photo.jpg`,
                notes: 'Finished repair',
                uploaded_by: woAssignedTo,
                uploaded_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
        };
      }
      if (table === 'work_order_updates') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'upd-1',
                work_order_id: WO_ID,
                action: 'created',
                new_status: 'assigned',
                actor_id: USER_MGR,
                actor_role: 'department_manager',
                note: 'Created order',
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
        };
      }
      return {};
    }),
    rpc: vi.fn((fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      if (opts.rpcResult) {
        return Promise.resolve(opts.rpcResult);
      }
      return Promise.resolve({ data: WO_ID, error: null });
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.example.com/signed-read' },
          error: null,
        }),
        createSignedUploadUrl: vi.fn().mockResolvedValue({
          data: { token: 'upload-token', signedUrl: 'https://storage.example.com/signed-upload' },
          error: null,
        }),
      }),
    },
  };

  vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(
    supabase as unknown as import('@supabase/supabase-js').SupabaseClient,
  );

  return { supabase, rpcCalls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Work Orders API (/v1/work-orders)', () => {
  describe('GET /v1/work-orders', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/v1/work-orders');
      expect(res.status).toBe(401);
    });

    it('returns 403 for citizens', async () => {
      mockSupabase({ callerRole: 'citizen' });
      const res = await request(app)
        .get('/v1/work-orders')
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(403);
    });

    it('returns 403 for staff without department_id', async () => {
      mockSupabase({ callerRole: 'employee', callerDept: null });
      const res = await request(app)
        .get('/v1/work-orders')
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(403);
    });

    it('returns 200 with scoped work orders for employee', async () => {
      mockSupabase({ callerId: USER_EMP, callerRole: 'employee', callerDept: DEPT_MINE });
      const res = await request(app)
        .get('/v1/work-orders')
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
      expect(res.body.work_orders).toHaveLength(1);
    });

    it('returns 200 for department_manager', async () => {
      mockSupabase({ callerId: USER_MGR, callerRole: 'department_manager', callerDept: DEPT_MINE });
      const res = await request(app)
        .get('/v1/work-orders')
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
    });

    it('returns 200 for admin', async () => {
      mockSupabase({ callerId: USER_ADMIN, callerRole: 'admin', callerDept: null });
      const res = await request(app)
        .get('/v1/work-orders')
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /v1/work-orders/:id', () => {
    it('returns 403 when employee tries to view work order assigned to someone else', async () => {
      mockSupabase({
        callerId: USER_OTHER_EMP,
        callerRole: 'employee',
        callerDept: DEPT_MINE,
        woAssignedTo: USER_EMP,
      });
      const res = await request(app)
        .get(`/v1/work-orders/${WO_ID}`)
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(403);
    });

    it('returns 403 when manager tries to view work order from another department', async () => {
      mockSupabase({
        callerId: USER_MGR,
        callerRole: 'department_manager',
        callerDept: DEPT_MINE,
        woDept: DEPT_OTHER,
      });
      const res = await request(app)
        .get(`/v1/work-orders/${WO_ID}`)
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(403);
    });

    it('returns 200 with work order and signed evidence URLs for assigned employee', async () => {
      mockSupabase({
        callerId: USER_EMP,
        callerRole: 'employee',
        callerDept: DEPT_MINE,
        woAssignedTo: USER_EMP,
      });
      const res = await request(app)
        .get(`/v1/work-orders/${WO_ID}`)
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
      expect(res.body.work_order.id).toBe(WO_ID);
      expect(res.body.work_order.evidence).toHaveLength(1);
      expect(res.body.work_order.evidence[0].url).toBe('https://storage.example.com/signed-read');
    });
  });

  describe('GET /v1/work-orders/:id/events', () => {
    it('returns 200 with timeline events for authorized manager', async () => {
      mockSupabase({
        callerId: USER_MGR,
        callerRole: 'department_manager',
        callerDept: DEPT_MINE,
        woDept: DEPT_MINE,
      });
      const res = await request(app)
        .get(`/v1/work-orders/${WO_ID}/events`)
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0].action).toBe('created');
    });
  });

  describe('POST /v1/work-orders', () => {
    const payload = {
      report_id: REPORT_ID,
      department_id: DEPT_MINE,
      title: 'Fix road surface',
      priority: 'High' as const,
      assigned_to: USER_EMP,
    };

    it('returns 403 when employee tries to create work order', async () => {
      mockSupabase({ callerRole: 'employee', callerDept: DEPT_MINE });
      const res = await request(app)
        .post('/v1/work-orders')
        .set('Authorization', 'Bearer token')
        .send(payload);
      expect(res.status).toBe(403);
    });

    it('returns 403 when department manager creates order for another department', async () => {
      mockSupabase({ callerRole: 'department_manager', callerDept: DEPT_MINE });
      const res = await request(app)
        .post('/v1/work-orders')
        .set('Authorization', 'Bearer token')
        .send({ ...payload, department_id: DEPT_OTHER });
      expect(res.status).toBe(403);
    });

    it('returns 201 and calls create_work_order RPC with actor id from JWT for department manager', async () => {
      const { rpcCalls } = mockSupabase({
        callerId: USER_MGR,
        callerRole: 'department_manager',
        callerDept: DEPT_MINE,
      });
      const res = await request(app)
        .post('/v1/work-orders')
        .set('Authorization', 'Bearer token')
        .send(payload);
      expect(res.status).toBe(201);
      expect(res.body.work_order_id).toBe(WO_ID);
      expect(rpcCalls).toHaveLength(1);
      expect(rpcCalls[0].fn).toBe('create_work_order');
      expect(rpcCalls[0].args).toMatchObject({
        p_actor: USER_MGR,
        p_report_id: REPORT_ID,
        p_department_id: DEPT_MINE,
        p_title: 'Fix road surface',
      });
    });
  });

  describe('POST /v1/work-orders/:id/assign', () => {
    it('returns 403 when employee tries to assign', async () => {
      mockSupabase({ callerRole: 'employee', callerDept: DEPT_MINE });
      const res = await request(app)
        .post(`/v1/work-orders/${WO_ID}/assign`)
        .set('Authorization', 'Bearer token')
        .send({ assigned_to: USER_EMP });
      expect(res.status).toBe(403);
    });

    it('returns 200 when manager assigns employee', async () => {
      const { rpcCalls } = mockSupabase({
        callerId: USER_MGR,
        callerRole: 'department_manager',
        callerDept: DEPT_MINE,
      });
      const res = await request(app)
        .post(`/v1/work-orders/${WO_ID}/assign`)
        .set('Authorization', 'Bearer token')
        .send({ assigned_to: USER_EMP, note: 'Urgent task' });
      expect(res.status).toBe(200);
      expect(rpcCalls[0].fn).toBe('assign_work_order');
      expect(rpcCalls[0].args).toMatchObject({
        p_actor: USER_MGR,
        p_work_order_id: WO_ID,
        p_assigned_to: USER_EMP,
      });
    });
  });

  describe('POST /v1/work-orders/:id/start', () => {
    it('returns 403 when non-assignee tries to start work order', async () => {
      mockSupabase({
        callerId: USER_OTHER_EMP,
        callerRole: 'employee',
        callerDept: DEPT_MINE,
        woAssignedTo: USER_EMP,
      });
      const res = await request(app)
        .post(`/v1/work-orders/${WO_ID}/start`)
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(403);
    });

    it('returns 200 when assigned employee starts work order', async () => {
      const { rpcCalls } = mockSupabase({
        callerId: USER_EMP,
        callerRole: 'employee',
        callerDept: DEPT_MINE,
        woAssignedTo: USER_EMP,
        woStatus: 'assigned',
      });
      const res = await request(app)
        .post(`/v1/work-orders/${WO_ID}/start`)
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
      expect(rpcCalls[0].fn).toBe('start_work_order');
      expect(rpcCalls[0].args).toMatchObject({
        p_actor: USER_EMP,
        p_work_order_id: WO_ID,
      });
    });
  });

  describe('POST /v1/work-orders/:id/evidence/sign', () => {
    it('returns 403 when non-assignee requests upload URL', async () => {
      mockSupabase({
        callerId: USER_OTHER_EMP,
        callerRole: 'employee',
        callerDept: DEPT_MINE,
        woAssignedTo: USER_EMP,
      });
      const res = await request(app)
        .post(`/v1/work-orders/${WO_ID}/evidence/sign`)
        .set('Authorization', 'Bearer token')
        .send({ file_name: 'photo.jpg' });
      expect(res.status).toBe(403);
    });

    it('returns 200 with signed upload URL for assigned employee', async () => {
      mockSupabase({
        callerId: USER_EMP,
        callerRole: 'employee',
        callerDept: DEPT_MINE,
        woAssignedTo: USER_EMP,
      });
      const res = await request(app)
        .post(`/v1/work-orders/${WO_ID}/evidence/sign`)
        .set('Authorization', 'Bearer token')
        .send({ file_name: 'repair.png' });
      expect(res.status).toBe(200);
      expect(res.body.storage_path).toContain(`${WO_ID}/`);
      expect(res.body.url).toBe('https://storage.example.com/signed-upload');
    });
  });

  describe('POST /v1/work-orders/:id/submit', () => {
    it('returns 400 when evidence path does not match work order prefix', async () => {
      mockSupabase({
        callerId: USER_EMP,
        callerRole: 'employee',
        callerDept: DEPT_MINE,
        woAssignedTo: USER_EMP,
      });
      const res = await request(app)
        .post(`/v1/work-orders/${WO_ID}/submit`)
        .set('Authorization', 'Bearer token')
        .send({ after_paths: ['00000000-0000-0000-0000-000000000000/photo.jpg'] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_EVIDENCE_PATH');
    });

    it('returns 200 and calls submit_work_order_completion RPC when valid', async () => {
      const validPath = `${WO_ID}/completed-photo.jpg`;
      const { rpcCalls } = mockSupabase({
        callerId: USER_EMP,
        callerRole: 'employee',
        callerDept: DEPT_MINE,
        woAssignedTo: USER_EMP,
        woStatus: 'in_progress',
      });
      const res = await request(app)
        .post(`/v1/work-orders/${WO_ID}/submit`)
        .set('Authorization', 'Bearer token')
        .send({ after_paths: [validPath], notes: 'Completed fixing the road' });
      expect(res.status).toBe(200);
      expect(rpcCalls[0].fn).toBe('submit_work_order_completion');
      expect(rpcCalls[0].args).toMatchObject({
        p_actor: USER_EMP,
        p_work_order_id: WO_ID,
        p_after_paths: [validPath],
      });
    });
  });

  describe('POST /v1/work-orders/:id/review', () => {
    it('returns 403 when assignee attempts to review own work order (self-review blocked)', async () => {
      mockSupabase({
        callerId: USER_MGR,
        callerRole: 'department_manager',
        callerDept: DEPT_MINE,
        woAssignedTo: USER_MGR,
      });
      const res = await request(app)
        .post(`/v1/work-orders/${WO_ID}/review`)
        .set('Authorization', 'Bearer token')
        .send({ decision: 'approved' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SELF_REVIEW_BLOCKED');
    });

    it('returns 400 when decision is rejected but review note is empty', async () => {
      mockSupabase({
        callerId: USER_MGR,
        callerRole: 'department_manager',
        callerDept: DEPT_MINE,
        woAssignedTo: USER_EMP,
      });
      const res = await request(app)
        .post(`/v1/work-orders/${WO_ID}/review`)
        .set('Authorization', 'Bearer token')
        .send({ decision: 'rejected', note: '' });
      expect(res.status).toBe(400);
    });

    it('returns 200 when manager approves work order', async () => {
      const { rpcCalls } = mockSupabase({
        callerId: USER_MGR,
        callerRole: 'department_manager',
        callerDept: DEPT_MINE,
        woAssignedTo: USER_EMP,
        woStatus: 'pending_verification',
      });
      const res = await request(app)
        .post(`/v1/work-orders/${WO_ID}/review`)
        .set('Authorization', 'Bearer token')
        .send({ decision: 'approved', note: 'Quality confirmed' });
      expect(res.status).toBe(200);
      expect(rpcCalls[0].fn).toBe('review_work_order');
      expect(rpcCalls[0].args).toMatchObject({
        p_actor: USER_MGR,
        p_work_order_id: WO_ID,
        p_decision: 'approved',
      });
    });

    it('returns 200 when manager rejects work order with reason', async () => {
      const { rpcCalls } = mockSupabase({
        callerId: USER_MGR,
        callerRole: 'department_manager',
        callerDept: DEPT_MINE,
        woAssignedTo: USER_EMP,
        woStatus: 'pending_verification',
      });
      const res = await request(app)
        .post(`/v1/work-orders/${WO_ID}/review`)
        .set('Authorization', 'Bearer token')
        .send({ decision: 'rejected', note: 'Debris still present at site' });
      expect(res.status).toBe(200);
      expect(rpcCalls[0].fn).toBe('review_work_order');
      expect(rpcCalls[0].args).toMatchObject({
        p_actor: USER_MGR,
        p_work_order_id: WO_ID,
        p_decision: 'rejected',
        p_note: 'Debris still present at site',
      });
    });
  });

  describe('POST /v1/work-orders/:id/cancel', () => {
    it('returns 403 when employee tries to cancel', async () => {
      mockSupabase({ callerRole: 'employee', callerDept: DEPT_MINE });
      const res = await request(app)
        .post(`/v1/work-orders/${WO_ID}/cancel`)
        .set('Authorization', 'Bearer token')
        .send({ reason: 'Duplicate issue' });
      expect(res.status).toBe(403);
    });

    it('returns 200 when department manager cancels with valid reason', async () => {
      const { rpcCalls } = mockSupabase({
        callerId: USER_MGR,
        callerRole: 'department_manager',
        callerDept: DEPT_MINE,
      });
      const res = await request(app)
        .post(`/v1/work-orders/${WO_ID}/cancel`)
        .set('Authorization', 'Bearer token')
        .send({ reason: 'Issue resolved by external utility contractor' });
      expect(res.status).toBe(200);
      expect(rpcCalls[0].fn).toBe('cancel_work_order');
      expect(rpcCalls[0].args).toMatchObject({
        p_actor: USER_MGR,
        p_work_order_id: WO_ID,
        p_reason: 'Issue resolved by external utility contractor',
      });
    });
  });
});
