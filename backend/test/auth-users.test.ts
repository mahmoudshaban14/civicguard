import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as clientModule from '../src/db/client.js';
import { createUserSchema } from '../src/modules/auth/schema.js';

const DEPT = '11111111-1111-4111-8111-111111111111';
const base = { full_name: 'Test User', email: 'Staff@Example.com', password: 'a-long-password-1', national_id: '29901011234567' };

function mockDb(opts: { callerRole: string; deptExists?: boolean }) {
  const profileUpdates: Record<string, unknown>[] = [];
  const createUser = vi.fn().mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'caller' } }, error: null }),
      admin: { createUser, deleteUser: vi.fn() },
    },
    from: vi.fn((table: string) => {
      if (table === 'departments') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: opts.deptExists === false ? null : { id: DEPT }, error: null }) };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'caller', role: opts.callerRole, department_id: DEPT, full_name: 'C' }, error: null }),
        update: vi.fn((v: Record<string, unknown>) => { profileUpdates.push(v); return { eq: vi.fn().mockResolvedValue({ error: null }) }; }),
      };
    }),
  };
  vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(supabase as unknown as import('@supabase/supabase-js').SupabaseClient);
  return { createUser, profileUpdates };
}
afterEach(() => vi.restoreAllMocks());
const post = (body: object) => request(app).post('/v1/auth/users').set('Authorization', 'Bearer t').send(body);

describe('createUserSchema', () => {
  it.each([
    ['legacy authority role', { ...base, role: 'authority', department_id: DEPT }],
    ['citizen role', { ...base, role: 'citizen' }],
    ['arbitrary role', { ...base, role: 'superadmin', department_id: DEPT }],
    ['employee without department', { ...base, role: 'employee' }],
    ['manager without department', { ...base, role: 'department_manager' }],
    ['admin with a department', { ...base, role: 'admin', department_id: DEPT }],
    ['malformed department id', { ...base, role: 'employee', department_id: 'nope' }],
  ])('rejects %s', (_n, body) => {
    expect(createUserSchema.safeParse(body).success).toBe(false);
  });
  it('accepts admin, manager and employee, and converts Arabic digits in the national id', () => {
    expect(createUserSchema.safeParse({ ...base, role: 'admin' }).success).toBe(true);
    expect(createUserSchema.safeParse({ ...base, role: 'department_manager', department_id: DEPT }).success).toBe(true);
    const r = createUserSchema.safeParse({ ...base, role: 'employee', department_id: DEPT, national_id: '٢٩٩٠١٠١١٢٣٤٥٦٧' });
    expect(r.success && r.data.national_id).toBe('29901011234567');
  });
});

describe('POST /v1/auth/users', () => {
  it('401 without a token', async () => {
    expect((await request(app).post('/v1/auth/users').send({})).status).toBe(401);
  });
  it.each(['citizen', 'employee', 'department_manager'])('403 when the caller is %s (no self-promotion)', async (callerRole) => {
    const { createUser } = mockDb({ callerRole });
    const res = await post({ ...base, role: 'admin' });
    expect(res.status).toBe(403);
    expect(createUser).not.toHaveBeenCalled();
  });
  it('400 and no account created when the department does not exist', async () => {
    const { createUser } = mockDb({ callerRole: 'admin', deptExists: false });
    const res = await post({ ...base, role: 'employee', department_id: DEPT });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DEPARTMENT');
    expect(createUser).not.toHaveBeenCalled();
  });
  it('admin creates an employee with role and department stored', async () => {
    const { profileUpdates } = mockDb({ callerRole: 'admin' });
    const res = await post({ ...base, role: 'employee', department_id: DEPT });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ role: 'employee', department_id: DEPT, email: 'staff@example.com' });
    expect(profileUpdates[0]).toMatchObject({ role: 'employee', department_id: DEPT });
  });
  it('admin account is stored without a department', async () => {
    const { profileUpdates } = mockDb({ callerRole: 'admin' });
    const res = await post({ ...base, role: 'admin' });
    expect(res.status).toBe(201);
    expect(profileUpdates[0]).toMatchObject({ role: 'admin', department_id: null });
  });
});

describe('PATCH /v1/auth/users/:id/promote', () => {
  const TARGET = '22222222-2222-4222-8222-222222222222';
  const promote = (id = TARGET, body: object = { role: 'department_manager' }, token = 'Bearer t') =>
    request(app)
      .patch(`/v1/auth/users/${id}/promote`)
      .set('Authorization', token)
      .send(body);

  function mockPromote(opts: {
    callerRole: string;
    targetExists?: boolean;
    targetRole?: string;
    targetDept?: string | null;
    concurrentConflict?: boolean;
  }) {
    const updates: Record<string, unknown>[] = [];
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'caller' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((col: string, val: string) => {
              if (val === 'caller') {
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'caller', role: opts.callerRole, department_id: null, full_name: 'Admin' },
                    error: null,
                  }),
                };
              }
              // target user
              if (opts.targetExists === false) {
                return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
              }
              return {
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: TARGET,
                    role: opts.targetRole ?? 'employee',
                    department_id: opts.targetDept !== undefined ? opts.targetDept : DEPT,
                    email: 'employee@example.com',
                    full_name: 'Emp',
                  },
                  error: null,
                }),
              };
            }),
            update: vi.fn((v: Record<string, unknown>) => {
              updates.push(v);
              const updateBuilder: Record<string, unknown> = {};
              updateBuilder.eq = vi.fn().mockReturnValue(updateBuilder);
              updateBuilder.select = vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue(
                  opts.concurrentConflict
                    ? { data: null, error: null }
                    : {
                        data: {
                          id: TARGET,
                          role: 'department_manager',
                          department_id: opts.targetDept !== undefined ? opts.targetDept : DEPT,
                          email: 'employee@example.com',
                          full_name: 'Emp',
                        },
                        error: null,
                      },
                ),
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: TARGET,
                    role: 'department_manager',
                    department_id: opts.targetDept !== undefined ? opts.targetDept : DEPT,
                    email: 'employee@example.com',
                    full_name: 'Emp',
                  },
                  error: null,
                }),
              });
              return updateBuilder;
            }),
          };
        }
        return {};
      }),
    };
    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(supabase as unknown as import('@supabase/supabase-js').SupabaseClient);
    return { updates };
  }

  it('401 without a token', async () => {
    const res = await request(app).patch(`/v1/auth/users/${TARGET}/promote`).send({ role: 'department_manager' });
    expect(res.status).toBe(401);
  });

  it.each(['citizen', 'employee', 'department_manager'])(
    '403 when caller is %s',
    async (callerRole) => {
      mockPromote({ callerRole });
      const res = await promote();
      expect(res.status).toBe(403);
    },
  );

  it('400 when attempting to promote to admin or invalid role', async () => {
    mockPromote({ callerRole: 'admin' });
    const res = await promote(TARGET, { role: 'admin' });
    expect(res.status).toBe(400);
  });

  it('404 when target user does not exist', async () => {
    mockPromote({ callerRole: 'admin', targetExists: false });
    const res = await promote();
    expect(res.status).toBe(404);
  });

  it.each(['citizen', 'department_manager', 'admin'])(
    '400 when target user role is %s (not employee)',
    async (targetRole) => {
      mockPromote({ callerRole: 'admin', targetRole });
      const res = await promote();
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PROMOTION');
    },
  );

  it('400 when target employee has no assigned department', async () => {
    mockPromote({ callerRole: 'admin', targetRole: 'employee', targetDept: null });
    const res = await promote();
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PROMOTION');
  });

  it('409 when target employee role or department changes concurrently during promotion', async () => {
    mockPromote({ callerRole: 'admin', targetRole: 'employee', targetDept: DEPT, concurrentConflict: true });
    const res = await promote();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PROMOTION_CONFLICT');
  });

  it('200 when admin promotes employee to department_manager, preserving department', async () => {
    const { updates } = mockPromote({ callerRole: 'admin', targetRole: 'employee', targetDept: DEPT });
    const res = await promote();
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: TARGET,
      role: 'department_manager',
      department_id: DEPT,
    });
    expect(updates[0]).toMatchObject({ role: 'department_manager' });
  });
});
