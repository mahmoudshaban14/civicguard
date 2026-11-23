
-- =========================================================
-- Work Orders: Validation and timestamp triggers
-- =========================================================

-- 1. Validate assigned employee belongs to the work order department.
CREATE OR REPLACE FUNCTION public.validate_work_order_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_employee_role text;
    v_employee_department uuid;
BEGIN
    -- No assignee is allowed for pending or cancelled work orders.
    IF NEW.assigned_to IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT p.role, p.department_id
    INTO v_employee_role, v_employee_department
    FROM public.profiles AS p
    WHERE p.id = NEW.assigned_to;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assigned user has no profile';
    END IF;

    IF v_employee_role <> 'employee' THEN
        RAISE EXCEPTION 'Only employees can be assigned to work orders';
    END IF;

    IF v_employee_department IS DISTINCT FROM NEW.department_id THEN
        RAISE EXCEPTION 'Employee must belong to the work order department';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER work_orders_validate_assignee
BEFORE INSERT OR UPDATE OF assigned_to, department_id
ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_work_order_assignee();


-- 2. Automatically maintain updated_at.
CREATE OR REPLACE FUNCTION public.set_work_order_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER work_orders_set_updated_at
BEFORE UPDATE ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_work_order_updated_at();


-- 3. Trigger functions are not directly callable by API roles.
REVOKE ALL ON FUNCTION public.validate_work_order_assignee()
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_work_order_updated_at()
FROM PUBLIC, anon, authenticated, service_role;
