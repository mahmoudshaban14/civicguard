import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as clientModule from '../src/db/client.js';

describe('GET /v1/reports', () => {
  it('should return 401 without an Authorization header', async () => {
    const res = await request(app).get('/v1/reports?mine=1');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error).toHaveProperty('requestId');
  });

  it('should return 401 with an invalid Bearer token', async () => {
    // Mock Supabase getUser returning error
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token' },
        }),
      },
    };
    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    const res = await request(app)
      .get('/v1/reports?mine=1')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toContain('Invalid or expired authentication token');
  });

  it('should return 200 with reports array when authenticated', async () => {
    const mockUser = { id: 'usr-123', email: 'citizen@example.com' };
    const mockProfile = { id: 'usr-123', role: 'citizen', department_id: null, full_name: 'Test Citizen' };
    const mockReports = [
      {
        id: 'rep-001',
        report_code: 'CG-2026-00001',
        user_id: 'usr-123',
        status: 'submitted',
        severity: 'High',
        created_at: new Date().toISOString(),
      },
    ];

    const mockDbQuery = Promise.resolve({ data: mockReports, error: null }) as Promise<{
      data: typeof mockReports;
      error: null;
    }> & {
      select: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      range: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
    };
    mockDbQuery.select = vi.fn().mockReturnValue(mockDbQuery);
    mockDbQuery.order = vi.fn().mockReturnValue(mockDbQuery);
    mockDbQuery.range = vi.fn().mockReturnValue(mockDbQuery);
    mockDbQuery.eq = vi.fn().mockReturnValue(mockDbQuery);

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
          };
        }
        return mockDbQuery;
      }),
    };

    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    const res = await request(app)
      .get('/v1/reports?mine=1')
      .set('Authorization', 'Bearer valid-citizen-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reports');
    expect(Array.isArray(res.body.reports)).toBe(true);
    expect(res.body.reports.length).toBe(1);
    expect(res.body.reports[0].id).toBe('rep-001');
  });
});
