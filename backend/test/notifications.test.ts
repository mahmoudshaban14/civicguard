import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as clientModule from '../src/db/client.js';

describe('GET /v1/notifications', () => {
  it('should return 401 without an Authorization header', async () => {
    const res = await request(app).get('/v1/notifications');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 200 with user notifications array', async () => {
    const mockUser = { id: 'usr-123', email: 'citizen@example.com' };
    const mockProfile = { id: 'usr-123', role: 'citizen', department_id: null };
    const mockNotifications = [
      {
        id: 'notif-1',
        user_id: 'usr-123',
        report_id: 'rep-1',
        type: 'report_submitted',
        title: 'Report Submitted',
        body: 'Report CG-2026-00001 submitted',
        read: false,
        created_at: new Date().toISOString(),
      },
    ];

    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: mockNotifications, error: null }),
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
        if (table === 'notifications') {
          return mockQueryBuilder;
        }
        return {};
      }),
    };

    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    const res = await request(app)
      .get('/v1/notifications')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('notifications');
    expect(res.body.notifications.length).toBe(1);
    expect(res.body.notifications[0].id).toBe('notif-1');
  });
});

describe('POST /v1/notifications/read', () => {
  it('should return 401 without an Authorization header', async () => {
    const res = await request(app).post('/v1/notifications/read').send({});

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 200 and mark notifications as read', async () => {
    const mockUser = { id: 'usr-123', email: 'citizen@example.com' };
    const mockProfile = { id: 'usr-123', role: 'citizen', department_id: null };

    const mockUpdateBuilder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
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
        if (table === 'notifications') {
          return mockUpdateBuilder;
        }
        return {};
      }),
    };

    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    const res = await request(app)
      .post('/v1/notifications/read')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
