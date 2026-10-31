import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as clientModule from '../src/db/client.js';

const REPORT = '11111111-1111-4111-8111-111111111111';
const MY_DEPT = 'dept-mine';
const OTHER_DEPT = 'dept-other';

function mockAs(role: string, deptId: string | null, reportDept: string) {
  const updates: unknown[] = [];
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'u1', role, department_id: deptId, full_name: 'U' }, error: null }) };
      }
      return {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: REPORT, status: 'submitted', assigned_department_id: reportDept, user_id: 'c', report_code: 'CG-1' }, error: null }),
        update: vi.fn((v: unknown) => { updates.push(v); return { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: REPORT, status: 'assigned' }, error: null }) }; }),
      };
    }),
  };
  vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(supabase as unknown as import('@supabase/supabase-js').SupabaseClient);
  return updates;
}
afterEach(() => vi.restoreAllMocks());
const patch = () => request(app).patch(`/v1/authority/reports/${REPORT}/status`).set('Authorization', 'Bearer t').send({ status: 'assigned' });

describe('department isolation for staff roles', () => {
  it.each(['department_manager', 'employee'])('%s cannot change a report of another department', async (role) => {
    const updates = mockAs(role, MY_DEPT, OTHER_DEPT);
    expect((await patch()).status).toBe(403);
    expect(updates).toHaveLength(0);
  });
  it.each(['department_manager', 'employee'])('%s can change a report of their own department', async (role) => {
    mockAs(role, MY_DEPT, MY_DEPT);
    expect((await patch()).status).toBe(200);
  });
  it('admin can change reports of any department', async () => {
    mockAs('admin', null, OTHER_DEPT);
    expect((await patch()).status).toBe(200);
  });
  it('citizen is rejected', async () => {
    mockAs('citizen', null, MY_DEPT);
    expect((await patch()).status).toBe(403);
  });
  it('legacy "authority" rows still work as employee during the transition', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockAs('authority', MY_DEPT, MY_DEPT);
    expect((await patch()).status).toBe(200);
  });
});
