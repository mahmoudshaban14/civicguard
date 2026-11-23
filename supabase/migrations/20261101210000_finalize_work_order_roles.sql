-- CivicGuard: finalize Work Orders role model.
-- Safe additive migration: no department is assigned to existing employees.

BEGIN;

-- Add account activation state. Existing accounts remain active by default.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Remove the temporary legacy-role constraint before converting old accounts.
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Convert legacy authority accounts to the approved employee role.
-- Their existing department_id values are preserved, including NULL.
UPDATE public.profiles
SET role = 'employee'
WHERE role = 'authority';

-- No new authority accounts are allowed.
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('citizen', 'admin', 'employee', 'department_manager'));

-- Employees may temporarily have no department; managers may not.
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_work_order_role_requires_department;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_work_order_role_requires_department
    CHECK (
        role <> 'department_manager'
        OR department_id IS NOT NULL
    );

COMMIT;
