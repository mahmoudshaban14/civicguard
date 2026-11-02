import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as clientModule from '../src/db/client.js';

const REPORT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const WO_ID = '11111111-2222-4333-8444-555555555555';
const CITIZEN = '60000000-0000-4000-8000-000000000001';
const OTHER_CITIZEN = '60000000-0000-4000-8000-000000000002';

interface Opts {
  role?: string;
  isActive?: boolean;
  reportOwner?: string;
  reportStatus?: string;
  workOrder?: { id: string; completed_at: string } | null;
  evidence?: { id: string; storage_path: string }[];
}

function mockSupabase(o: Opts = {}) {
  const calls = { woEq: [] as [string, unknown][], evEq: [] as [string, unknown][], signed: [] as string[] };

  const chain = (result: () => unknown, eqLog?: [string, unknown][]) => {
    const b: Record<string, unknown> = {};
    b.select = vi.fn().mockReturnValue(b);
    b.order = vi.fn().mockReturnValue(b);
    b.limit = vi.fn().mockReturnValue(b);
    b.eq = vi.fn((c: string, v: unknown) => { eqLog?.push([c, v]); return b; });
    b.maybeSingle = vi.fn().mockImplementation(async () => result());
    b.then = (resolve: (v: unknown) => void) => resolve(result());
    return b;
  };

  const wo = o.workOrder === undefined ? { id: WO_ID, completed_at: '2026-11-02T10:00:00Z' } : o.workOrder;
  const evidence = o.evidence ?? [
    { id: 'ev-1', storage_path: `${WO_ID}/a.jpg` },
    { id: 'ev-2', storage_path: `${WO_ID}/b.png` },
  ];

  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: CITIZEN, email: 'c@x.com' } }, error: null }) },
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn(async (path: string) => {
          calls.signed.push(path);
          return { data: { signedUrl: `https://signed/${path}` }, error: null };
        }),
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles')
        return chain(() => ({
          data: { id: CITIZEN, role: o.role ?? 'citizen', department_id: null, full_name: 'C', is_active: o.isActive ?? true },
          error: null,
        }));
      if (table === 'reports')
        return chain(() => ({
          data: { id: REPORT_ID, user_id: o.reportOwner ?? CITIZEN, status: o.reportStatus ?? 'resolved' },
          error: null,
        }));
      if (table === 'work_orders') return chain(() => ({ data: wo, error: null }), calls.woEq);
      if (table === 'work_order_evidence') return chain(() => ({ data: evidence, error: null }), calls.evEq);
      return chain(() => ({ data: null, error: null }));
    }),
  };
  vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(supabase as unknown as import('@supabase/supabase-js').SupabaseClient);
  return calls;
}

const get = () => request(app).get(`/v1/reports/${REPORT_ID}/resolution-photos`).set('Authorization', 'Bearer t');

afterEach(() => vi.restoreAllMocks());

describe('GET /v1/reports/:id/resolution-photos', () => {
  it('returns signed after-photos to the owner of a resolved, approved report', async () => {
    const calls = mockSupabase();
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.photos).toHaveLength(2);
    expect(res.body.photos[0]).toEqual({ id: 'ev-1', url: `https://signed/${WO_ID}/a.jpg` });
    expect(res.body.expires_in_seconds).toBe(600);
    expect(calls.woEq).toContainEqual(['status', 'completed']);
    expect(calls.woEq).toContainEqual(['last_review_decision', 'approved']);
    expect(calls.evEq).toContainEqual(['kind', 'after']);
  });

  it('does not leak internal fields (uploader, notes, storage paths)', async () => {
    mockSupabase();
    const res = await get();
    expect(JSON.stringify(res.body)).not.toMatch(/uploaded_by|notes|storage_path/);
  });

  it('404s for a citizen who does not own the report', async () => {
    const calls = mockSupabase({ reportOwner: OTHER_CITIZEN });
    const res = await get();
    expect(res.status).toBe(404);
    expect(calls.signed).toHaveLength(0);
  });

  it.each(['submitted', 'assigned', 'in_progress', 'rejected'])('404s while the report status is %s', async (status) => {
    const calls = mockSupabase({ reportStatus: status });
    const res = await get();
    expect(res.status).toBe(404);
    expect(calls.signed).toHaveLength(0);
  });

  it('404s when no approved completed work order exists (report resolved by other means)', async () => {
    const calls = mockSupabase({ workOrder: null });
    const res = await get();
    expect(res.status).toBe(404);
    expect(calls.signed).toHaveLength(0);
  });

  it.each(['employee', 'department_manager', 'admin'])('403s for staff role %s (they use /v1/work-orders)', async (role) => {
    const calls = mockSupabase({ role });
    const res = await get();
    expect(res.status).toBe(403);
    expect(calls.signed).toHaveLength(0);
  });

  it('403s for an inactive account before reaching the service', async () => {
    const calls = mockSupabase({ isActive: false });
    const res = await get();
    expect(res.status).toBe(403);
    expect(res.body.error?.code ?? res.body.code).toBe('ACCOUNT_INACTIVE');
    expect(calls.signed).toHaveLength(0);
  });

  it('401s without a token and 400s on a malformed id', async () => {
    mockSupabase();
    expect((await request(app).get(`/v1/reports/${REPORT_ID}/resolution-photos`)).status).toBe(401);
    expect((await request(app).get('/v1/reports/not-a-uuid/resolution-photos').set('Authorization', 'Bearer t')).status).toBe(400);
  });
});
