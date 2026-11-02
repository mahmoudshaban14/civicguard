import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as clientModule from '../src/db/client.js';

function mock(profile: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  b.select = vi.fn().mockReturnValue(b);
  b.eq = vi.fn().mockReturnValue(b);
  b.maybeSingle = vi.fn().mockResolvedValue(profile);
  const select = b.select as ReturnType<typeof vi.fn>;
  vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'u@x.com' } }, error: null }) },
    from: vi.fn(() => b),
  } as unknown as import('@supabase/supabase-js').SupabaseClient);
  return select;
}

const hit = () => request(app).get('/v1/notifications').set('Authorization', 'Bearer t');
afterEach(() => vi.restoreAllMocks());

describe('requireAuth profile gate', () => {
  it('rejects a deactivated account with ACCOUNT_INACTIVE', async () => {
    mock({ data: { id: 'u1', role: 'employee', department_id: 'd1', full_name: 'E', is_active: false }, error: null });
    const res = await hit();
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toContain('ACCOUNT_INACTIVE');
  });

  it('rejects a user with no profile row instead of defaulting to citizen', async () => {
    mock({ data: null, error: null });
    expect((await hit()).status).toBe(403);
  });

  it('rejects when the profile query fails (e.g. is_active migration not applied)', async () => {
    mock({ data: null, error: { message: 'column profiles.is_active does not exist', code: '42703' } });
    expect((await hit()).status).toBe(403);
  });

  it('selects is_active from profiles', async () => {
    const select = mock({ data: { id: 'u1', role: 'citizen', department_id: null, full_name: 'C', is_active: false }, error: null });
    await hit();
    expect(select).toHaveBeenCalledWith(expect.stringContaining('is_active'));
  });
});
