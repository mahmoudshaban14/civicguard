import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as clientModule from '../src/db/client.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

function mockAdmin(targetExists: boolean) {
  const updated: unknown[] = [];
  let reportLookups = 0;
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'admin-1', role: 'admin', department_id: null, full_name: 'A' }, error: null }) };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(async () => {
          reportLookups += 1; // 1st lookup = the report itself, 2nd = the duplicate target
          return reportLookups === 1
            ? { data: { id: A, status: 'submitted', assigned_department_id: 'd1', user_id: 'u', report_code: 'CG-1' }, error: null }
            : { data: targetExists ? { id: B, assigned_department_id: 'd1' } : null, error: null };
        }),
        update: vi.fn((v: unknown) => { updated.push(v); return { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: A, status: 'duplicate' }, error: null }) }; }),
      };
    }),
  };
  vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(supabase as unknown as import('@supabase/supabase-js').SupabaseClient);
  return updated;
}

afterEach(() => vi.restoreAllMocks());
const patch = (body: object) => request(app).patch(`/v1/authority/reports/${A}/status`).set('Authorization', 'Bearer t').send(body);

describe('PATCH status with duplicate_of', () => {
  it('links the duplicate when status is duplicate', async () => {
    const updated = mockAdmin(true);
    const res = await patch({ status: 'duplicate', duplicate_of: B });
    expect(res.status).toBe(200);
    expect(updated[0]).toMatchObject({ status: 'duplicate', duplicate_of: B });
  });
  it('rejects duplicate_of with another status', async () => {
    mockAdmin(true);
    expect((await patch({ status: 'assigned', duplicate_of: B })).status).toBe(400);
  });
  it('rejects a report duplicating itself', async () => {
    mockAdmin(true);
    expect((await patch({ status: 'duplicate', duplicate_of: A })).status).toBe(400);
  });
  it('404 when the target report does not exist', async () => {
    mockAdmin(false);
    expect((await patch({ status: 'duplicate', duplicate_of: B })).status).toBe(404);
  });
});
