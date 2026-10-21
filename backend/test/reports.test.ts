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

describe('POST /v1/reports', () => {
  it('should return 401 without an Authorization header', async () => {
    const res = await request(app)
      .post('/v1/reports')
      .send({
        category_id: 'pothole',
        latitude: 30.0444,
        longitude: 31.2357,
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 when required fields are missing', async () => {
    const mockUser = { id: 'usr-123', email: 'citizen@example.com' };
    const mockProfile = { id: 'usr-123', role: 'citizen', department_id: null };

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
        return {};
      }),
    };

    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    const res = await request(app)
      .post('/v1/reports')
      .set('Authorization', 'Bearer valid-token')
      .send({
        // Missing category_id, latitude, longitude
        description: 'Test pothole',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when category does not exist or is inactive', async () => {
    const mockUser = { id: 'usr-123', email: 'citizen@example.com' };
    const mockProfile = { id: 'usr-123', role: 'citizen', department_id: null };

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
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      }),
    };

    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    const res = await request(app)
      .post('/v1/reports')
      .set('Authorization', 'Bearer valid-token')
      .send({
        category_id: 'non-existent-category',
        latitude: 30.0444,
        longitude: 31.2357,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CATEGORY');
  });

  it('should create report with database-derived category, department, and severity', async () => {
    const mockUser = { id: 'usr-123', email: 'citizen@example.com' };
    const mockProfile = { id: 'usr-123', role: 'citizen', department_id: null };
    const mockCategory = {
      id: 'pothole',
      label: 'Pothole / Road Damage',
      department: 'Road Maintenance Department',
      department_id: 'dept-road-123',
      default_severity: 'High',
    };
    const mockInsertedReport = {
      id: 'rep-created-1',
      report_code: 'CG-2026-00042',
      user_id: 'usr-123',
      category_id: 'pothole',
      category: 'Pothole / Road Damage',
      department: 'Road Maintenance Department',
      assigned_department_id: 'dept-road-123',
      severity: 'High',
      status: 'submitted',
      description: 'Dangerous pothole on the right lane',
      latitude: 30.0444,
      longitude: 31.2357,
      area_name: 'Downtown Cairo',
      image_path: 'usr-123/img-123.jpg',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let insertedData: Record<string, unknown> | null = null;

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
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockCategory, error: null }),
          };
        }
        if (table === 'reports') {
          return {
            insert: vi.fn().mockImplementation((payload) => {
              insertedData = payload;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockInsertedReport, error: null }),
                }),
              };
            }),
          };
        }
        return {};
      }),
    };

    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    const res = await request(app)
      .post('/v1/reports')
      .set('Authorization', 'Bearer valid-token')
      .send({
        category_id: 'pothole',
        description: 'Dangerous pothole on the right lane',
        latitude: 30.0444,
        longitude: 31.2357,
        area_name: 'Downtown Cairo',
        image_path: 'usr-123/img-123.jpg',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('report');
    expect(res.body.report.id).toBe('rep-created-1');
    expect(res.body.report.report_code).toBe('CG-2026-00042');
    expect(res.body.report.status).toBe('submitted');
    expect(res.body.report.severity).toBe('High');
    expect(res.body.report.department).toBe('Road Maintenance Department');

    // Verify service set the authoritative department and severity from categories table
    expect(insertedData).not.toBeNull();
    expect((insertedData as unknown as Record<string, unknown>).user_id).toBe('usr-123');
    expect((insertedData as unknown as Record<string, unknown>).category).toBe('Pothole / Road Damage');
    expect((insertedData as unknown as Record<string, unknown>).department).toBe('Road Maintenance Department');
    expect((insertedData as unknown as Record<string, unknown>).assigned_department_id).toBe('dept-road-123');
    expect((insertedData as unknown as Record<string, unknown>).severity).toBe('High');
    expect((insertedData as unknown as Record<string, unknown>).status).toBe('submitted');
  });
});

describe('GET /v1/reports/:id', () => {
  const validReportId = '11111111-2222-3333-4444-555555555555';

  it('should return 401 without an Authorization header', async () => {
    const res = await request(app).get(`/v1/reports/${validReportId}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 when id is not a valid UUID', async () => {
    const mockUser = { id: 'usr-123', email: 'citizen@example.com' };
    const mockProfile = { id: 'usr-123', role: 'citizen', department_id: null };

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
        return {};
      }),
    };

    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    const res = await request(app)
      .get('/v1/reports/invalid-uuid-123')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 when report does not exist', async () => {
    const mockUser = { id: 'usr-123', email: 'citizen@example.com' };
    const mockProfile = { id: 'usr-123', role: 'citizen', department_id: null };

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
        if (table === 'reports') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      }),
    };

    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    const res = await request(app)
      .get(`/v1/reports/${validReportId}`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should return 403 when citizen attempts to view another user report', async () => {
    const mockUser = { id: 'usr-citizen-1', email: 'citizen1@example.com' };
    const mockProfile = { id: 'usr-citizen-1', role: 'citizen', department_id: null };
    const otherUserReport = {
      id: validReportId,
      user_id: 'usr-citizen-2', // different user
      report_code: 'CG-2026-00001',
      status: 'submitted',
    };

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
        if (table === 'reports') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: otherUserReport, error: null }),
          };
        }
        return {};
      }),
    };

    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    const res = await request(app)
      .get(`/v1/reports/${validReportId}`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should return 200 with report, events, and signedImageUrl for report owner', async () => {
    const mockUser = { id: 'usr-citizen-1', email: 'citizen1@example.com' };
    const mockProfile = { id: 'usr-citizen-1', role: 'citizen', department_id: null };
    const myReport = {
      id: validReportId,
      user_id: 'usr-citizen-1',
      report_code: 'CG-2026-00001',
      category_id: 'pothole',
      category: 'Pothole / Road Damage',
      status: 'submitted',
      severity: 'High',
      image_path: 'usr-citizen-1/pothole.jpg',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const mockEvents = [
      {
        id: 'evt-1',
        report_id: validReportId,
        actor_id: 'usr-citizen-1',
        actor_role: 'citizen',
        old_status: null,
        new_status: 'submitted',
        note: 'Report submitted',
        created_at: new Date().toISOString(),
      },
    ];

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
        if (table === 'reports') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: myReport, error: null }),
          };
        }
        if (table === 'report_events') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockEvents, error: null }),
          };
        }
        return {};
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://example.com/storage/signed-pothole.jpg' },
            error: null,
          }),
        }),
      },
    };

    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    const res = await request(app)
      .get(`/v1/reports/${validReportId}`)
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('report');
    expect(res.body.report.id).toBe(validReportId);
    expect(res.body).toHaveProperty('events');
    expect(res.body.events.length).toBe(1);
    expect(res.body.events[0].new_status).toBe('submitted');
    expect(res.body).toHaveProperty('signedImageUrl', 'https://example.com/storage/signed-pothole.jpg');
  });
});
