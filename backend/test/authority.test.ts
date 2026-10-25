import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as clientModule from '../src/db/client.js';

describe('Authority Routes (/v1/authority)', () => {
  const validReportId = '11111111-2222-3333-4444-555555555555';
  const validDeptId = '22222222-3333-4444-5555-666666666666';
  const otherDeptId = '99999999-8888-7777-6666-555555555555';

  describe('GET /v1/authority/reports', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/v1/authority/reports');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 when user is a citizen', async () => {
      const mockUser = { id: 'usr-cit', email: 'citizen@example.com' };
      const mockProfile = { id: 'usr-cit', role: 'citizen', department_id: null };

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
        .get('/v1/authority/reports')
        .set('Authorization', 'Bearer citizen-token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 200 with reports when user is an admin', async () => {
      const mockUser = { id: 'usr-admin', email: 'admin@example.com' };
      const mockProfile = { id: 'usr-admin', role: 'admin', department_id: null };
      const mockReports = [
        {
          id: validReportId,
          report_code: 'CG-2026-00001',
          status: 'submitted',
          category: 'Pothole',
        },
      ];

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockReports, error: null }),
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
            return mockQueryBuilder;
          }
          return {};
        }),
      };

      vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

      const res = await request(app)
        .get('/v1/authority/reports')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reports');
      expect(res.body.reports.length).toBe(1);
    });
  });

  describe('PATCH /v1/authority/reports/:id/status', () => {
    it('should reject invalid status transition for authority role', async () => {
      const mockUser = { id: 'usr-auth', email: 'auth@example.com' };
      const mockProfile = { id: 'usr-auth', role: 'authority', department_id: validDeptId };
      const currentReport = {
        id: validReportId,
        status: 'submitted',
        assigned_department_id: validDeptId,
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
              maybeSingle: vi.fn().mockResolvedValue({ data: currentReport, error: null }),
            };
          }
          return {};
        }),
      };

      vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

      // Illegal transition: 'submitted' directly to 'resolved'
      const res = await request(app)
        .patch(`/v1/authority/reports/${validReportId}/status`)
        .set('Authorization', 'Bearer auth-token')
        .send({ status: 'resolved' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('should allow valid status transition and update status', async () => {
      const mockUser = { id: 'usr-auth', email: 'auth@example.com' };
      const mockProfile = { id: 'usr-auth', role: 'authority', department_id: validDeptId };
      const currentReport = {
        id: validReportId,
        status: 'assigned',
        assigned_department_id: validDeptId,
      };
      const updatedReport = {
        id: validReportId,
        status: 'in_progress',
        assigned_department_id: validDeptId,
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
              maybeSingle: vi.fn().mockResolvedValue({ data: currentReport, error: null }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: updatedReport, error: null }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

      // Valid transition: 'assigned' -> 'in_progress'
      const res = await request(app)
        .patch(`/v1/authority/reports/${validReportId}/status`)
        .set('Authorization', 'Bearer auth-token')
        .send({ status: 'in_progress', note: 'Crew dispatched' });

      expect(res.status).toBe(200);
      expect(res.body.report.status).toBe('in_progress');
    });
  });

  describe('POST /v1/authority/reports/:id/assign', () => {
    it('should assign department to report as admin', async () => {
      const mockUser = { id: 'usr-admin', email: 'admin@example.com' };
      const mockProfile = { id: 'usr-admin', role: 'admin', department_id: null };
      const mockDept = { id: validDeptId, name: 'Road Maintenance Department' };
      const currentReport = {
        id: validReportId,
        status: 'manual_review_required',
        assigned_department_id: null,
      };
      const updatedReport = {
        id: validReportId,
        status: 'assigned',
        assigned_department_id: validDeptId,
        department: 'Road Maintenance Department',
        status_changed_by: 'usr-admin',
        status_note: 'Assigned via admin',
      };

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedReport, error: null }),
          }),
        }),
      });

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
          if (table === 'departments') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockDept, error: null }),
            };
          }
          if (table === 'reports') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: currentReport, error: null }),
              update: mockUpdate,
            };
          }
          return {};
        }),
      };

      vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

      const res = await request(app)
        .post(`/v1/authority/reports/${validReportId}/assign`)
        .set('Authorization', 'Bearer admin-token')
        .send({ department_id: validDeptId, note: 'Assigned via admin' });

      expect(res.status).toBe(200);
      expect(res.body.report.assigned_department_id).toBe(validDeptId);
      expect(res.body.report.status).toBe('assigned');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status_changed_by: 'usr-admin',
          status_note: 'Assigned via admin',
        }),
      );
    });

    it('should allow authority user to reassign report belonging to own department', async () => {
      const mockUser = { id: 'usr-auth', email: 'auth@example.com' };
      const mockProfile = { id: 'usr-auth', role: 'authority', department_id: validDeptId };
      const newDeptId = '33333333-4444-5555-6666-777777777777';
      const mockDept = { id: newDeptId, name: 'Waste Management Department' };
      const currentReport = {
        id: validReportId,
        status: 'assigned',
        assigned_department_id: validDeptId, // matches authority's department
      };
      const updatedReport = {
        id: validReportId,
        status: 'assigned',
        assigned_department_id: newDeptId,
        department: 'Waste Management Department',
        status_changed_by: 'usr-auth',
        status_note: 'Reassigning to waste',
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
          if (table === 'departments') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockDept, error: null }),
            };
          }
          if (table === 'reports') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: currentReport, error: null }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: updatedReport, error: null }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

      const res = await request(app)
        .post(`/v1/authority/reports/${validReportId}/assign`)
        .set('Authorization', 'Bearer auth-token')
        .send({ department_id: newDeptId, note: 'Reassigning to waste' });

      expect(res.status).toBe(200);
      expect(res.body.report.assigned_department_id).toBe(newDeptId);
    });

    it('should return 403 when authority user tries to reassign report of another department', async () => {
      const mockUser = { id: 'usr-auth', email: 'auth@example.com' };
      const mockProfile = { id: 'usr-auth', role: 'authority', department_id: validDeptId };
      const otherDeptId = '99999999-8888-7777-6666-555555555555';
      const mockDept = { id: otherDeptId, name: 'Other Department' };
      const currentReport = {
        id: validReportId,
        status: 'assigned',
        assigned_department_id: otherDeptId, // does NOT match authority's department
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
          if (table === 'departments') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockDept, error: null }),
            };
          }
          if (table === 'reports') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: currentReport, error: null }),
            };
          }
          return {};
        }),
      };

      vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

      const res = await request(app)
        .post(`/v1/authority/reports/${validReportId}/assign`)
        .set('Authorization', 'Bearer auth-token')
        .send({ department_id: otherDeptId });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 403 when authority user has no department_id', async () => {
      const mockUser = { id: 'usr-auth-nodept', email: 'nodept@example.com' };
      const mockProfile = { id: 'usr-auth-nodept', role: 'authority', department_id: null };
      const mockDept = { id: validDeptId, name: 'Road Maintenance' };
      const currentReport = {
        id: validReportId,
        status: 'assigned',
        assigned_department_id: validDeptId,
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
          if (table === 'departments') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockDept, error: null }),
            };
          }
          if (table === 'reports') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: currentReport, error: null }),
            };
          }
          return {};
        }),
      };

      vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

      const res = await request(app)
        .post(`/v1/authority/reports/${validReportId}/assign`)
        .set('Authorization', 'Bearer auth-token')
        .send({ department_id: validDeptId });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('PATCH /v1/authority/reports/:id/action-status', () => {
    it('should reject invalid action_status enum', async () => {
      const mockUser = { id: 'usr-admin', email: 'admin@example.com' };
      const mockProfile = { id: 'usr-admin', role: 'admin' };

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
        .patch(`/v1/authority/reports/${validReportId}/action-status`)
        .set('Authorization', 'Bearer admin-token')
        .send({ action_status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject authority user if report is not in their department', async () => {
      const mockUser = { id: 'usr-auth', email: 'auth@example.com' };
      const mockProfile = { id: 'usr-auth', role: 'authority', department_id: validDeptId };
      const currentReport = {
        id: validReportId,
        assigned_department_id: otherDeptId,
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
              maybeSingle: vi.fn().mockResolvedValue({ data: currentReport, error: null }),
            };
          }
          return {};
        }),
      };

      vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

      const res = await request(app)
        .patch(`/v1/authority/reports/${validReportId}/action-status`)
        .set('Authorization', 'Bearer auth-token')
        .send({ action_status: 'action_in_progress' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow authority user to update action_status on department report', async () => {
      const mockUser = { id: 'usr-auth', email: 'auth@example.com' };
      const mockProfile = { id: 'usr-auth', role: 'authority', department_id: validDeptId };
      const currentReport = {
        id: validReportId,
        assigned_department_id: validDeptId,
      };
      const updatedReport = {
        id: validReportId,
        assigned_department_id: validDeptId,
        action_status: 'action_completed',
        updated_by: 'usr-auth',
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
              maybeSingle: vi.fn().mockResolvedValue({ data: currentReport, error: null }),
              update: vi.fn().mockImplementation((payload) => {
                expect(payload.action_status).toBe('action_completed');
                expect(payload.updated_by).toBe('usr-auth');
                return {
                  eq: vi.fn().mockReturnThis(),
                  select: vi.fn().mockReturnThis(),
                  single: vi.fn().mockResolvedValue({ data: updatedReport, error: null }),
                };
              }),
            };
          }
          return {};
        }),
      };

      vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

      const res = await request(app)
        .patch(`/v1/authority/reports/${validReportId}/action-status`)
        .set('Authorization', 'Bearer auth-token')
        .send({ action_status: 'action_completed' });

      expect(res.status).toBe(200);
      expect(res.body.report.action_status).toBe('action_completed');
      expect(res.body.report.updated_by).toBe('usr-auth');
    });

    it('should allow admin to update action_status regardless of department', async () => {
      const mockUser = { id: 'usr-admin', email: 'admin@example.com' };
      const mockProfile = { id: 'usr-admin', role: 'admin' };
      const currentReport = {
        id: validReportId,
        assigned_department_id: otherDeptId,
      };
      const updatedReport = {
        id: validReportId,
        assigned_department_id: otherDeptId,
        action_status: 'action_in_progress',
        updated_by: 'usr-admin',
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
              maybeSingle: vi.fn().mockResolvedValue({ data: currentReport, error: null }),
              update: vi.fn().mockImplementation((payload) => {
                expect(payload.action_status).toBe('action_in_progress');
                expect(payload.updated_by).toBe('usr-admin');
                return {
                  eq: vi.fn().mockReturnThis(),
                  select: vi.fn().mockReturnThis(),
                  single: vi.fn().mockResolvedValue({ data: updatedReport, error: null }),
                };
              }),
            };
          }
          return {};
        }),
      };

      vi.spyOn(clientModule, 'getSupabaseAdmin').mockReturnValue(mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

      const res = await request(app)
        .patch(`/v1/authority/reports/${validReportId}/action-status`)
        .set('Authorization', 'Bearer admin-token')
        .send({ action_status: 'action_in_progress' });

      expect(res.status).toBe(200);
      expect(res.body.report.action_status).toBe('action_in_progress');
      expect(res.body.report.updated_by).toBe('usr-admin');
    });
  });
});

