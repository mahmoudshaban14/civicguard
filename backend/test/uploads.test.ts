import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as clientModule from '../src/db/client.js';

describe('POST /v1/uploads/sign', () => {
  it('should return 401 without an Authorization header', async () => {
    const res = await request(app)
      .post('/v1/uploads/sign')
      .send({ contentType: 'image/jpeg' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 when contentType is not an allowed image type', async () => {
    const mockUser = { id: 'usr-123', email: 'citizen@example.com' };
    const mockProfile = { id: 'usr-123', role: 'citizen', department_id: null, full_name: 'Test Citizen' };

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

    const res = await request(app)
      .post('/v1/uploads/sign')
      .set('Authorization', 'Bearer valid-token')
      .send({ contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when sizeBytes exceeds 5MB limit', async () => {
    const mockUser = { id: 'usr-123', email: 'citizen@example.com' };
    const mockProfile = { id: 'usr-123', role: 'citizen', department_id: null, full_name: 'Test Citizen' };

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

    const res = await request(app)
      .post('/v1/uploads/sign')
      .set('Authorization', 'Bearer valid-token')
      .send({
        contentType: 'image/jpeg',
        sizeBytes: 6 * 1024 * 1024, // 6MB
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 200 with signed upload URL scoped to user folder', async () => {
    const mockUser = { id: 'usr-123', email: 'citizen@example.com' };
    const mockProfile = { id: 'usr-123', role: 'citizen', department_id: null, full_name: 'Test Citizen' };

    const mockStorage = {
      from: vi.fn().mockReturnValue({
        createSignedUploadUrl: vi.fn().mockImplementation((path: string) =>
          Promise.resolve({
            data: {
              signedUrl: `https://mock-storage.supabase.co/upload/${path}`,
              token: 'mock-upload-token',
            },
            error: null,
          }),
        ),
      }),
    };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }),
      storage: mockStorage,
    };

    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    const res = await request(app)
      .post('/v1/uploads/sign')
      .set('Authorization', 'Bearer valid-token')
      .send({
        contentType: 'image/png',
        sizeBytes: 1024 * 1024,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('bucket', 'report-images');
    expect(res.body).toHaveProperty('path');
    expect(res.body.path.startsWith('usr-123/')).toBe(true);
    expect(res.body.path.endsWith('.png')).toBe(true);
    expect(res.body).toHaveProperty('signedUrl');
    expect(res.body).toHaveProperty('token', 'mock-upload-token');
  });
});
