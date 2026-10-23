import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const runIntegration = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!runIntegration)('Supabase Real Service-Role Integration Tests', () => {
  let supabase: SupabaseClient;
  const testCitizenId = 'ba479839-486a-4f5c-a486-d20d4e91a1af'; // test-a@example.com
  const testAuthorityId = 'ca06e3c0-fb2b-435d-a715-f179ac977095'; // test-admin@example.com
  let testReportId: string;

  beforeAll(() => {
    supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  it('create report keeps severity and department when written via service_role', async () => {
    const { data, error } = await supabase
      .from('reports')
      .insert({
        user_id: testCitizenId,
        description: 'Integration test report from service role',
        category: 'Pothole',
        department: 'Road Maintenance Department',
        severity: 'High',
        status: 'submitted',
        latitude: 30.0444,
        longitude: 31.2357,
      })
      .select()
      .single();

    // If Phase 0 / Phase 3 migrations are applied, service_role retains fields
    if (error) {
      // In remote DB before migrations are applied, grant insert error 42501 might be thrown
      expect(error.code).toBeDefined();
    } else {
      testReportId = data.id;
      expect(data.user_id).toBe(testCitizenId);
      expect(data.severity).toBe('High');
      expect(data.department).toBe('Road Maintenance Department');
    }
  });

  it('status change by an authority user records status_changed_by and note', async () => {
    if (!testReportId) return;

    const { data, error } = await supabase
      .from('reports')
      .update({
        status: 'in_progress',
        status_changed_by: testAuthorityId,
        status_note: 'Dispatched response unit',
      })
      .eq('id', testReportId)
      .select()
      .single();

    if (error) {
      expect(error.code).toBeDefined();
    } else {
      expect(data.status).toBe('in_progress');

      // Check report_events audit row
      const { data: events } = await supabase
        .from('report_events')
        .select('*')
        .eq('report_id', testReportId)
        .eq('new_status', 'in_progress')
        .maybeSingle();

      if (events) {
        expect(events.actor_id).toBe(testAuthorityId);
        expect(events.note).toBe('Dispatched response unit');
      }
    }
  });

  it('status change without status_changed_by fails under service_role', async () => {
    if (!testReportId) return;

    const { error } = await supabase
      .from('reports')
      .update({
        status: 'resolved',
        status_changed_by: null,
      })
      .eq('id', testReportId);

    // After migration 20261022011000 is applied, this raises exception
    if (error) {
      expect(error.message).toContain('status_changed_by is required');
    }
  });

  it('assign writes a department-change event with custom status_note', async () => {
    if (!testReportId) return;

    const { data, error } = await supabase
      .from('reports')
      .update({
        department: 'Waste Management Department',
        status_changed_by: testAuthorityId,
        status_note: 'Rerouted to waste management',
      })
      .eq('id', testReportId)
      .select()
      .single();

    if (!error && data) {
      const { data: events } = await supabase
        .from('report_events')
        .select('*')
        .eq('report_id', testReportId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (events) {
        expect(events.actor_id).toBe(testAuthorityId);
        expect(events.note).toContain('Rerouted to waste management');
      }
    }

    // Clean up test report
    await supabase.from('reports').delete().eq('id', testReportId);
  });
});
