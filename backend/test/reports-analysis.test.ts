import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as clientModule from '../src/db/client.js';

const ANALYSIS_ID = '11111111-1111-4111-8111-111111111111';
const aiResult = {
  category_id: 'pothole', severity: 'Critical', confidence: 0.91, explanation: 'Deep pothole',
  secondary_issues: [], requires_manual_review: false,
};

function setup(analysisRow: Record<string, unknown> | null) {
  const state: { inserted?: Record<string, unknown>; linked?: unknown } = {};
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-1' } }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'usr-1', role: 'citizen' }, error: null }) };
      }
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'pothole', label: 'Pothole', department: 'Roads', department_id: 'd1', default_severity: 'High' }, error: null }),
        };
      }
      if (table === 'ai_requests') {
        return {
          select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: analysisRow, error: null }),
          update: vi.fn((v: unknown) => {
            state.linked = v;
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  is: vi.fn().mockReturnValue({
                    select: vi.fn().mockResolvedValue({ data: [{ id: analysisRow?.id }], error: null }),
                  }),
                }),
              }),
            };
          }),
        };
      }
      // reports
      return {
        insert: vi.fn((row: Record<string, unknown>) => {
          state.inserted = row;
          return { select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'r-1', ...row }, error: null }) }) };
        }),
      };
    }),
  };
  vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(supabase as unknown as import('@supabase/supabase-js').SupabaseClient);
  return state;
}

const payload = { category_id: 'pothole', latitude: 30, longitude: 31, image_path: 'usr-1/a.jpg', analysis_id: ANALYSIS_ID };
afterEach(() => vi.restoreAllMocks());

describe('POST /v1/reports with analysis_id', () => {
  it('uses the stored AI result and links the analysis to the report', async () => {
    const state = setup({ id: ANALYSIS_ID, user_id: 'usr-1', report_id: null, status: 'success', image_path: 'usr-1/a.jpg', result: aiResult });
    const res = await request(app).post('/v1/reports').set('Authorization', 'Bearer t').send(payload);
    expect(res.status).toBe(201);
    expect(state.inserted).toMatchObject({ severity: 'Critical', confidence: 0.91, status: 'ai_analyzed', explanation: 'Deep pothole' });
    expect(state.linked).toEqual({ report_id: 'r-1' });
  });

  it('ignores AI details when the citizen picked a different category', async () => {
    const state = setup({ id: ANALYSIS_ID, user_id: 'usr-1', report_id: null, status: 'success', image_path: 'usr-1/a.jpg', result: { ...aiResult, category_id: 'graffiti' } });
    const res = await request(app).post('/v1/reports').set('Authorization', 'Bearer t').send(payload);
    expect(res.status).toBe(201);
    expect(state.inserted).toMatchObject({ severity: 'High', status: 'submitted' });
    expect(state.inserted).not.toHaveProperty('confidence');
  });

  it("rejects someone else's analysis", async () => {
    setup({ id: ANALYSIS_ID, user_id: 'other', report_id: null, status: 'success', image_path: 'usr-1/a.jpg', result: aiResult });
    const res = await request(app).post('/v1/reports').set('Authorization', 'Bearer t').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ANALYSIS');
  });

  it('rejects an analysis that was already used', async () => {
    setup({ id: ANALYSIS_ID, user_id: 'usr-1', report_id: 'r-0', status: 'success', image_path: 'usr-1/a.jpg', result: aiResult });
    const res = await request(app).post('/v1/reports').set('Authorization', 'Bearer t').send(payload);
    expect(res.status).toBe(409);
  });
});
