import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as clientModule from '../src/db/client.js';
import * as providerModule from '../src/modules/analysis/provider.js';
import { findDuplicateCandidates, runDuplicateCheck } from '../src/modules/duplicates/service.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const NEW = { id: 'new-1', category_id: 'pothole', latitude: 30.0, longitude: 31.0, image_path: 'u1/new.jpg' };

/** Chainable query mock that resolves to `result` when awaited. */
function query(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'not', 'gte', 'lte', 'in', 'or', 'order']) q[m] = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

// ~11 m north of NEW, ~220 m north of NEW
const near = { id: 'old-near', latitude: 30.0001, longitude: 31.0, image_path: 'u2/near.jpg' };
const far = { id: 'old-far', latitude: 30.002, longitude: 31.0, image_path: 'u3/far.jpg' };

function mockDb(opts: { reports?: unknown[]; upsert?: ReturnType<typeof vi.fn>; links?: unknown[]; others?: unknown[] } = {}) {
  const upsert = opts.upsert ?? vi.fn().mockResolvedValue({ error: null });
  let reportsCalls = 0;
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null }) },
    storage: {
      from: vi.fn().mockReturnValue({
        download: vi.fn().mockResolvedValue({ data: new Blob([new Uint8Array(JPEG)]), error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed/x' } }),
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'admin-1', role: 'admin', department_id: null, full_name: 'A' }, error: null }) };
      }
      if (table === 'report_duplicate_candidates') {
        return { upsert, select: vi.fn(() => query({ data: opts.links ?? [], error: null })) };
      }
      reportsCalls += 1;
      // 1st reports call in list flow = the report itself; handled via maybeSingle below
      const q = query({ data: opts.others ?? opts.reports ?? [], error: null }) as Record<string, unknown>;
      q.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'new-1', assigned_department_id: 'd1' }, error: null });
      return q;
    }),
  };
  vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(supabase as unknown as import('@supabase/supabase-js').SupabaseClient);
  return { upsert, reportsCalls: () => reportsCalls };
}

afterEach(() => vi.restoreAllMocks());

describe('findDuplicateCandidates', () => {
  it('keeps only candidates inside the radius, nearest first', async () => {
    mockDb({ reports: [far, near] });
    const res = await findDuplicateCandidates(NEW);
    expect(res.map((c) => c.id)).toEqual(['old-near']);
    expect(res[0].distance_m).toBeGreaterThan(5);
    expect(res[0].distance_m).toBeLessThan(20);
  });

  it('returns nothing when the report has no category or location', async () => {
    mockDb({ reports: [near] });
    expect(await findDuplicateCandidates({ ...NEW, latitude: null })).toEqual([]);
    expect(await findDuplicateCandidates({ ...NEW, category_id: null })).toEqual([]);
  });
});

describe('runDuplicateCheck', () => {
  it('stores nothing when no candidates are nearby', async () => {
    const { upsert } = mockDb({ reports: [far] });
    expect(await runDuplicateCheck(NEW)).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('stores the candidate with Gemini verdict when photos can be compared', async () => {
    const { upsert } = mockDb({ reports: [near] });
    const compareImages = vi.fn().mockResolvedValue({ same_issue: true, confidence: 0.9, reason: 'Same crack and kerb' });
    vi.spyOn(providerModule, 'getAiProvider').mockReturnValue({ name: 'gemini:test', analyze: vi.fn(), compareImages });
    expect(await runDuplicateCheck(NEW)).toBe(1);
    expect(compareImages).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0][0]).toMatchObject({
      report_id: 'new-1', candidate_report_id: 'old-near', ai_checked: true, ai_same_issue: true, ai_confidence: 0.9, ai_model: 'gemini:test',
    });
  });

  it('still stores the candidate (unchecked) if the Gemini comparison fails', async () => {
    const { upsert } = mockDb({ reports: [near] });
    vi.spyOn(providerModule, 'getAiProvider').mockReturnValue({ name: 'g', analyze: vi.fn(), compareImages: vi.fn().mockRejectedValue(new Error('boom')) });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await runDuplicateCheck(NEW);
    expect(upsert.mock.calls[0][0][0]).toMatchObject({ ai_checked: false, ai_same_issue: null });
  });

  it('works without any AI provider (geo match only)', async () => {
    const { upsert } = mockDb({ reports: [near] });
    vi.spyOn(providerModule, 'getAiProvider').mockReturnValue(null);
    await runDuplicateCheck(NEW);
    expect(upsert.mock.calls[0][0][0]).toMatchObject({ ai_checked: false, candidate_report_id: 'old-near' });
  });
});

describe('GET /v1/authority/reports/:id/duplicates', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  it('401 without a token', async () => {
    expect((await request(app).get(`/v1/authority/reports/${id}/duplicates`)).status).toBe(401);
  });

  it('returns candidates with AI verdict first and a signed image URL', async () => {
    mockDb({
      links: [
        { id: 'l1', report_id: '11111111-1111-4111-8111-111111111111', candidate_report_id: 'o1', distance_m: 8, ai_checked: false, ai_same_issue: null, ai_confidence: null, ai_reason: null, created_at: 't' },
        { id: 'l2', report_id: '11111111-1111-4111-8111-111111111111', candidate_report_id: 'o2', distance_m: 30, ai_checked: true, ai_same_issue: true, ai_confidence: 0.88, ai_reason: 'Same hole', created_at: 't' },
      ],
      others: [
        { id: 'o1', report_code: 'CG-1', category: 'Pothole', status: 'submitted', severity: 'High', description: null, latitude: 1, longitude: 1, image_path: 'u/1.jpg', assigned_department_id: 'd1', created_at: 't' },
        { id: 'o2', report_code: 'CG-2', category: 'Pothole', status: 'assigned', severity: 'High', description: null, latitude: 1, longitude: 1, image_path: null, assigned_department_id: 'd1', created_at: 't' },
      ],
    });
    const res = await request(app).get(`/v1/authority/reports/${id}/duplicates`).set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.duplicates.map((d: { report: { report_code: string } }) => d.report.report_code)).toEqual(['CG-2', 'CG-1']);
    expect(res.body.duplicates[0].ai).toMatchObject({ checked: true, same_issue: true, confidence: 0.88 });
    expect(res.body.duplicates[1].report.image_url).toBe('https://signed/x');
    expect(res.body.duplicates[0].relation).toBe('earlier_report');
    // reporter identity is never exposed
    expect(JSON.stringify(res.body)).not.toContain('user_id');
  });

  it('is not available to citizens', async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'c1' } }, error: null }) },
      from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'c1', role: 'citizen' }, error: null }) })),
    };
    vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(supabase as unknown as import('@supabase/supabase-js').SupabaseClient);
    const res = await request(app).get(`/v1/authority/reports/${id}/duplicates`).set('Authorization', 'Bearer t');
    expect(res.status).toBe(403);
  });
});
