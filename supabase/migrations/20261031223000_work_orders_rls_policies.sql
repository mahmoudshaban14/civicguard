
-- =========================================================
-- Work Orders: Department-scoped read access
-- =========================================================

-- 1. Helper function to check whether the current user
--    can read work orders belonging to a department.
CREATE OR REPLACE FUNCTION public.can_access_work_order_department(
    p_department_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = (SELECT auth.uid())
          AND (
              p.role = 'admin'
              OR (
                  p.role IN ('department_manager', 'employee')
                  AND p.department_id = p_department_id
              )
          )
    );
$$;

-- The helper is only available to authenticated users.
REVOKE ALL ON FUNCTION public.can_access_work_order_department(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_access_work_order_department(uuid)
TO authenticated;


-- 2. Grant read access at table level.
GRANT SELECT ON public.work_orders TO authenticated;
GRANT SELECT ON public.work_order_evidence TO authenticated;
GRANT SELECT ON public.work_order_updates TO authenticated;


-- 3. Work Orders: admin sees all; department staff sees own department.
DROP POLICY IF EXISTS work_orders_select_by_department
ON public.work_orders;

CREATE POLICY work_orders_select_by_department
ON public.work_orders
FOR SELECT
TO authenticated
USING (
    (SELECT public.can_access_work_order_department(department_id))
);


-- 4. Evidence: access follows the parent work order.
DROP POLICY IF EXISTS work_order_evidence_select_by_department
ON public.work_order_evidence;

CREATE POLICY work_order_evidence_select_by_department
ON public.work_order_evidence
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.work_orders AS wo
        WHERE wo.id = work_order_evidence.work_order_id
          AND public.can_access_work_order_department(wo.department_id)
    )
);


-- 5. Updates/history: access follows the parent work order.
DROP POLICY IF EXISTS work_order_updates_select_by_department
ON public.work_order_updates;

CREATE POLICY work_order_updates_select_by_department
ON public.work_order_updates
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.work_orders AS wo
        WHERE wo.id = work_order_updates.work_order_id
          AND public.can_access_work_order_department(wo.department_id)
    )
);
