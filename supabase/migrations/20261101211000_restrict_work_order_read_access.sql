-- =========================================================
-- Work Orders: restrict employees to assigned work only
-- Managers remain scoped to their own department; admins are global.
-- Inactive profiles receive no Work Orders read access.
-- =========================================================

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
          AND p.is_active = true
          AND (
              p.role = 'admin'
              OR (
                  p.role = 'department_manager'
                  AND p.department_id = p_department_id
              )
          )
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_work_order_department(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_access_work_order_department(uuid)
TO authenticated;

-- Work Orders: employees can read only records assigned to themselves.
DROP POLICY IF EXISTS work_orders_select_by_department
ON public.work_orders;

CREATE POLICY work_orders_select_by_department
ON public.work_orders
FOR SELECT
TO authenticated
USING (
    (SELECT public.can_access_work_order_department(department_id))
    OR EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = (SELECT auth.uid())
          AND p.is_active = true
          AND p.role = 'employee'
          AND p.department_id = work_orders.department_id
          AND work_orders.assigned_to = (SELECT auth.uid())
    )
);

-- Evidence follows the exact same access rule as its parent Work Order.
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
          AND (
              (SELECT public.can_access_work_order_department(wo.department_id))
              OR (
                  wo.assigned_to = (SELECT auth.uid())
                  AND EXISTS (
                      SELECT 1
                      FROM public.profiles AS p
                      WHERE p.id = (SELECT auth.uid())
                        AND p.is_active = true
                        AND p.role = 'employee'
                        AND p.department_id = wo.department_id
                  )
              )
          )
    )
);

-- Work Order history follows the exact same access rule.
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
          AND (
              (SELECT public.can_access_work_order_department(wo.department_id))
              OR (
                  wo.assigned_to = (SELECT auth.uid())
                  AND EXISTS (
                      SELECT 1
                      FROM public.profiles AS p
                      WHERE p.id = (SELECT auth.uid())
                        AND p.is_active = true
                        AND p.role = 'employee'
                        AND p.department_id = wo.department_id
                  )
              )
          )
    )
);
