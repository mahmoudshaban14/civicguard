-- =========================================================
-- Work Orders: enforce active actor on every audited action
-- =========================================================

-- 1. Strengthen the shared manager/admin authorization helper.
CREATE OR REPLACE FUNCTION public.assert_work_order_actor(
    p_actor uuid,
    p_department_id uuid,
    p_manager_only boolean DEFAULT true
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_role text;
    v_department_id uuid;
    v_is_active boolean;
BEGIN
    IF NOT public.is_trusted_caller() THEN
        RAISE EXCEPTION 'Untrusted caller';
    END IF;

    SELECT role, department_id, is_active
    INTO v_role, v_department_id, v_is_active
    FROM public.profiles
    WHERE id = p_actor;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Actor profile not found';
    END IF;

    IF v_is_active IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Inactive actors cannot perform Work Order actions';
    END IF;

    IF v_role = 'admin' THEN
        RETURN v_role;
    END IF;

    IF p_manager_only AND v_role <> 'department_manager' THEN
        RAISE EXCEPTION 'Only admins or department managers may perform this action';
    END IF;

    IF NOT p_manager_only
       AND v_role NOT IN ('department_manager', 'employee') THEN
        RAISE EXCEPTION 'Actor is not authorized for this department';
    END IF;

    IF v_department_id IS DISTINCT FROM p_department_id THEN
        RAISE EXCEPTION 'Actor does not belong to this department';
    END IF;

    RETURN v_role;
END;
$$;


-- 2. Validate the actor on every Work Order audit entry.
CREATE OR REPLACE FUNCTION public.guard_work_order_update_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_role text;
    v_department_id uuid;
    v_is_active boolean;
    v_wo_department_id uuid;
    v_assigned_to uuid;
BEGIN
    SELECT role, department_id, is_active
    INTO v_role, v_department_id, v_is_active
    FROM public.profiles
    WHERE id = NEW.actor_id;

    IF NOT FOUND OR v_is_active IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Work Order actor must have an active profile';
    END IF;

    IF NEW.actor_role IS DISTINCT FROM v_role THEN
        RAISE EXCEPTION 'Work Order actor role does not match profile';
    END IF;

    SELECT department_id, assigned_to
    INTO v_wo_department_id, v_assigned_to
    FROM public.work_orders
    WHERE id = NEW.work_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Work Order not found';
    END IF;

    IF v_role = 'admin' THEN
        RETURN NEW;
    END IF;

    IF v_department_id IS DISTINCT FROM v_wo_department_id THEN
        RAISE EXCEPTION 'Actor does not belong to this Work Order department';
    END IF;

    IF v_role = 'employee' AND v_assigned_to IS DISTINCT FROM NEW.actor_id THEN
        RAISE EXCEPTION 'Employee is not assigned to this Work Order';
    END IF;

    IF v_role NOT IN ('employee', 'department_manager') THEN
        RAISE EXCEPTION 'Actor role is not authorized for Work Orders';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_order_update_actor_guard
ON public.work_order_updates;

CREATE TRIGGER work_order_update_actor_guard
BEFORE INSERT ON public.work_order_updates
FOR EACH ROW
EXECUTE FUNCTION public.guard_work_order_update_actor();

REVOKE ALL ON FUNCTION public.guard_work_order_update_actor()
FROM PUBLIC, anon, authenticated;