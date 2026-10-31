-- Add the new Work Orders roles.
-- Legacy authority accounts remain unchanged during the transition.

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (
    role IN (
        'citizen',
        'authority',
        'admin',
        'employee',
        'department_manager'
    )
);

-- Employees and department managers must belong to a department.
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_work_order_role_requires_department
CHECK (
    role NOT IN ('employee', 'department_manager')
    OR department_id IS NOT NULL
);