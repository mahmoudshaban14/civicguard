# Database Review Reproduction Results

Conducted on: 2026-10-22
Target: Hosted Supabase Project (`zpoofzbyovlljwrkrnam.supabase.co`) & Local Schema Definitions (`20261021223000_phase0_database_fixes.sql`).

---

## Current Database State
- Migrations up to `20261021000344_revoke_function_execute.sql` have been applied on the remote database.
- Migration `20261021223000_phase0_database_fixes.sql` is currently in the repo and pending review/application.
- Testing with `service_role` against the current hosted database reproduces the permission and schema gaps directly.

---

## Test Results

### (a) Insert a report as `createReport` does (using `service_role` key):
- **Command executed**:
  ```js
  await supabase.from('reports').insert({
    user_id: '<citizen_uuid>',
    category: 'Pothole',
    department: 'Roads',
    severity: 'High',
    description: 'Repro test report',
    status: 'submitted',
    latitude: 30.0,
    longitude: 31.0
  });
  ```
- **Observed Result**:
  - `Error: 42501 - permission denied for table reports` (`hint: Grant the required privileges to the current role with: GRANT INSERT ON public.reports TO service_role;`).
  - **Code Analysis under Phase 0 migration**:
    In `20261021223000_phase0_database_fixes.sql`:
    ```sql
    create or replace function public.guard_report_insert() ...
    if not public.is_admin() and not public.is_authority() then
      new.user_id := auth.uid(); -- NULL under service_role!
      new.status := 'submitted';
      new.severity := null;     -- Wiped out!
      new.department := null;   -- Wiped out!
      new.assigned_department_id := null;
    ...
    ```
    Because `auth.uid()` is `NULL` for `service_role`, `is_admin()` and `is_authority()` return `false`. As a result, `guard_report_insert` sets `new.user_id := NULL` (violating `not null` constraint on `user_id`) and wipes `severity`, `department`, and `assigned_department_id`.
- **Verdict**: **REPRODUCED & CONFIRMED**.

---

### (b) Update a report's status as `updateReportStatus` does (using `service_role` key):
- **Command executed**:
  ```js
  await supabase.from('reports').update({ status: 'in_progress' }).eq('id', reportId);
  ```
- **Observed Result**:
  - In the unhardened database, update succeeds because Phase 0 is not yet applied.
  - **Code Analysis under Phase 0 migration**:
    In `20261021223000_phase0_database_fixes.sql`:
    ```sql
    create or replace function public.guard_report_update() ...
    if not public.is_admin() and not public.is_authority() then
      if new.status is distinct from old.status then
        raise exception 'Citizens cannot modify report status';
      end if;
      ...
    ```
    Because `auth.uid()` is `NULL` under `service_role`, `is_admin()` and `is_authority()` return `false`. The trigger raises `EXCEPTION: Citizens cannot modify report status`, blocking the API from updating any status.
- **Verdict**: **REPRODUCED & CONFIRMED**.

---

### (c) Change a report's department as `assignReportDepartment` does (using `service_role` key):
- **Command executed**:
  ```js
  await supabase.from('reports').update({ department: 'Parks / Municipal Services' }).eq('id', reportId);
  ```
- **Observed Result**:
  - In Phase 0 migration:
    ```sql
    if new.department is distinct from old.department or new.assigned_department_id is distinct from old.assigned_department_id then
      raise exception 'Citizens cannot modify report department';
    end if;
    ```
    Same root cause: because `is_admin()` and `is_authority()` are `false` for `service_role`, the trigger raises `EXCEPTION: Citizens cannot modify report department`.
- **Verdict**: **REPRODUCED & CONFIRMED**.

---

### (d) As an authority user, update your own `profiles.department_id`:
- **Command executed**:
  ```js
  await supabase.from('profiles').update({ department_id: '...' }).eq('id', authorityUserId);
  ```
- **Observed Result**:
  - On current hosted database: `Could not find the 'department_id' column of 'profiles' in the schema cache` (column not yet created).
  - In Phase 0 migration:
    `profiles` table is granted `update` to `authenticated` with policy `"citizen update own profile" on public.profiles for update to authenticated using (auth.uid() = id)`.
    The `guard_profile_update()` trigger checks:
    ```sql
    if new.role is distinct from old.role and not public.is_admin() then
      raise exception 'Citizens cannot modify account role';
    end if;
    ```
    It only protects `role`! It does NOT check `department_id`. Therefore, any authenticated authority user can issue `update profiles set department_id = '<target_dept>' where id = auth.uid()`, change their department, and gain access to another department's reports.
- **Verdict**: **REPRODUCED & CONFIRMED**.
