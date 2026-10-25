import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as clientModule from '../src/db/client.js';
import * as providerModule from '../src/modules/analysis/provider.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const categories = [
  { id: 'pothole', label: 'Pothole / Road Damage', department: 'Road Maintenance Department', department_id: 'd1', default_severity: 'High', explanation: null },
  { id: 'other', label: 'Other', department: 'Manual Routing', department_id: null, default_severity: 'Low', explanation: null },
];

function mockSupabase(opts: { recentCount?: number; download?: Buffer | null } = {}) {
  const inserted: unknown[] = [];
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-1', email: 'a@b.c' } }, error: null }) },
    storage: {
      from: vi.fn().mockReturnValue({
        download: vi.fn().mockResolvedValue(
          opts.download === null
            ? { data: null, error: { message: 'nf' } }
            : { data: new Blob([new Uint8Array(opts.download ?? JPEG)]), error: null },
        ),
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'usr-1', role: 'citizen', department_id: null, full_name: 'T' }, error: null }),
        };
      }
      if (table === 'categories') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: categories, error: null }) };
      }
      // ai_requests: count query + insert
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ gte: vi.fn().mockResolvedValue({ count: opts.recentCount ?? 0, error: null }) }),
        }),
        insert: vi.fn((row: unknown) => {
          inserted.push(row);
          return { select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'an-1' }, error: null }) }) };
        }),
      };
    }),
  };
  vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(supabase as unknown as import('@supabase/supabase-js').SupabaseClient);
  return { inserted };
}

const body = { image_path: 'usr-1/abc.jpg', description: 'big hole', latitude: 30, longitude: 31 };

afterEach(() => vi.restoreAllMocks());

describe('POST /v1/reports/analyze', () => {
  it('401 without token', async () => {
    const res = await request(app).post('/v1/reports/analyze').send(body);
    expect(res.status).toBe(401);
  });

  it('400 when image_path is in another user folder', async () => {
    mockSupabase();
    const res = await request(app).post('/v1/reports/analyze').set('Authorization', 'Bearer t').send({ ...body, image_path: 'other/abc.jpg' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_IMAGE_PATH');
  });

  it('429 when the hourly AI limit is reached', async () => {
    mockSupabase({ recentCount: 999 });
    const res = await request(app).post('/v1/reports/analyze').set('Authorization', 'Bearer t').send(body);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('AI_RATE_LIMIT');
  });

  it('400 when the stored file is not an image', async () => {
    mockSupabase({ download: Buffer.from('%PDF-1.4 hello') });
    const res = await request(app).post('/v1/reports/analyze').set('Authorization', 'Bearer t').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_IMAGE');
  });

  it('returns a Gemini result with severity, department and description', async () => {
    const { inserted } = mockSupabase();
    const analyze = vi.fn().mockResolvedValue({
      image_description: 'A deep pothole in the road.',
      is_civic_issue: true,
      category_id: 'pothole',
      confidence: 0.92,
      secondary_category_ids: [],
      severity: 'High',
      severity_reason: 'In a traffic lane',
      immediate_danger: false,
      recommended_action: 'Fill it.',
    });
    vi.spyOn(providerModule, 'getAiProvider').mockReturnValue({ name: 'gemini:test', analyze });

    const res = await request(app).post('/v1/reports/analyze').set('Authorization', 'Bearer t').send(body);
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('gemini');
    expect(res.body.analysis_id).toBe('an-1');
    expect(res.body.result).toMatchObject({
      category_id: 'pothole',
      department: 'Road Maintenance Department',
      severity: 'High',
      image_description: 'A deep pothole in the road.',
      requires_manual_review: false,
    });
    expect(analyze.mock.calls[0][0].image.mimeType).toBe('image/jpeg');
    expect(inserted[0]).toMatchObject({ user_id: 'usr-1', status: 'success', model: 'gemini:test' });
  });

  it('falls back to manual review when Gemini throws', async () => {
    const { inserted } = mockSupabase();
    vi.spyOn(providerModule, 'getAiProvider').mockReturnValue({ name: 'gemini:test', analyze: vi.fn().mockRejectedValue(new Error('timeout')) });
    const res = await request(app).post('/v1/reports/analyze').set('Authorization', 'Bearer t').send(body);
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('fallback');
    expect(res.body.analysis_id).toBeNull();
    expect(res.body.result.requires_manual_review).toBe(true);
    expect(inserted[0]).toMatchObject({ status: 'failed', error_message: 'timeout' });
  });

  it('falls back when no API key is configured', async () => {
    mockSupabase();
    vi.spyOn(providerModule, 'getAiProvider').mockReturnValue(null);
    const res = await request(app).post('/v1/reports/analyze').set('Authorization', 'Bearer t').send(body);
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('fallback');
  });
});
