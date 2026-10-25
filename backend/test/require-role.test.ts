import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requireAuth } from '../src/middleware/auth.js';
import { requireRole } from '../src/middleware/require-role.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import * as clientModule from '../src/db/client.js';

function createTestApp() {
  const testApp = express();
  testApp.use(express.json());

  testApp.get('/admin-only', requireAuth, requireRole('admin'), (_req, res) => {
    res.json({ success: true });
  });

  testApp.get('/authority-or-admin', requireAuth, requireRole('authority', 'admin'), (_req, res) => {
    res.json({ success: true });
  });

  testApp.use(errorHandler);
  return testApp;
}

describe('requireRole middleware', () => {

  it('should return 403 when a citizen accesses admin route', async () => {
    const testApp = createTestApp();
    const mockUser = { id: 'citizen-id', email: 'citizen@example.com' };
    const mockProfile = { id: 'citizen-id', role: 'citizen', department_id: null, full_name: 'Citizen' };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }),
    };
    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    const res = await request(testApp)
      .get('/admin-only')
      .set('Authorization', 'Bearer citizen-token');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should allow access when user role matches', async () => {
    const testApp = createTestApp();
    const mockUser = { id: 'admin-id', email: 'admin@example.com' };
    const mockProfile = { id: 'admin-id', role: 'admin', department_id: null, full_name: 'Admin' };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }),
    };
    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    const res = await request(testApp)
      .get('/admin-only')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
