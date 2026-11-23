
-- =========================================================
-- Work Orders: Security and integrity hardening
-- =========================================================

-- 1. Prevent deleting parent records while audit history exists.
ALTER TABLE public.work_orders
    DROP CONSTRAINT IF EXISTS work_orders_report_id_fkey,
    DROP CONSTRAINT IF EXISTS work_orders_assigned_to_fkey;

ALTER TABLE public.work_orders
    ADD CONSTRAINT work_orders_report_id_fkey
        FOREIGN KEY (report_id)
        REFERENCES public.reports(id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT work_orders_assigned_to_fkey
        FOREIGN KEY (assigned_to)
        REFERENCES auth.users(id)
        ON DELETE RESTRICT;

ALTER TABLE public.work_order_updates
    DROP CONSTRAINT IF EXISTS work_order_updates_work_order_id_fkey,
    DROP CONSTRAINT IF EXISTS work_order_updates_old_assigned_to_fkey,
    DROP CONSTRAINT IF EXISTS work_order_updates_new_assigned_to_fkey;

ALTER TABLE public.work_order_updates
    ADD CONSTRAINT work_order_updates_work_order_id_fkey
        FOREIGN KEY (work_order_id)
        REFERENCES public.work_orders(id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT work_order_updates_old_assigned_to_fkey
        FOREIGN KEY (old_assigned_to)
        REFERENCES auth.users(id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT work_order_updates_new_assigned_to_fkey
        FOREIGN KEY (new_assigned_to)
        REFERENCES auth.users(id)
        ON DELETE RESTRICT;


-- 2. Protect active assignments from employee role/department changes.
CREATE OR REPLACE FUNCTION public.guard_work_order_employee_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF OLD.role = 'employee'
       AND (
           NEW.role IS DISTINCT FROM OLD.role
           OR NEW.department_id IS DISTINCT FROM OLD.department_id
       )
       AND EXISTS (
           SELECT 1
           FROM public.work_orders wo
           WHERE wo.assigned_to = OLD.id
             AND wo.status NOT IN ('completed', 'cancelled')
       )
    THEN
        RAISE EXCEPTION
            'Cannot change employee role or department while active work orders are assigned';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_work_order_employee
ON public.profiles;

CREATE TRIGGER profiles_guard_work_order_employee
BEFORE UPDATE OF role, department_id
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_work_order_employee_profile();

REVOKE ALL ON FUNCTION public.guard_work_order_employee_profile()
FROM PUBLIC, anon, authenticated, service_role;


-- 3. Create work order with department validation.
CREATE OR REPLACE FUNCTION public.create_work_order(
    p_report_id uuid,
    p_department_id uuid,
    p_title text,
    p_description text,
    p_priority text,
    p_target_at timestamptz,
    p_assigned_to uuid,
    p_actor uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_work_order_id uuid;
    v_status text;
    v_report_department uuid;
    v_actor_role text;
BEGIN
    v_actor_role := public.assert_work_order_actor(
        p_actor, p_department_id, true
    );

    IF p_report_id IS NULL OR p_department_id IS NULL THEN
        RAISE EXCEPTION 'Report and department are required';
    END IF;

    IF p_title IS NULL OR btrim(p_title) = '' THEN
        RAISE EXCEPTION 'Work order title is required';
    END IF;

    IF p_priority IS NULL
       OR p_priority NOT IN ('Low', 'Medium', 'High', 'Critical') THEN
        RAISE EXCEPTION 'Invalid work order priority';
    END IF;

    SELECT assigned_department_id
    INTO v_report_department
    FROM public.reports
    WHERE id = p_report_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Report not found';
    END IF;

    IF v_report_department IS NOT NULL
       AND v_report_department IS DISTINCT FROM p_department_id THEN
        RAISE EXCEPTION
            'Work order department must match the report assigned department';
    END IF;

    IF p_assigned_to IS NOT NULL THEN
        PERFORM 1
        FROM public.profiles
        WHERE id = p_assigned_to
          AND role = 'employee'
          AND department_id = p_department_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Assigned employee must belong to this department';
        END IF;

        v_status := 'assigned';
    ELSE
        v_status := 'pending';
    END IF;

    INSERT INTO public.work_orders (
        report_id, department_id, assigned_to,
        title, description, priority, status,
        target_completion_at, created_by
    )
    VALUES (
        p_report_id, p_department_id, p_assigned_to,
        p_title, p_description, p_priority, v_status,
        p_target_at, p_actor
    )
    RETURNING id INTO v_work_order_id;

    INSERT INTO public.work_order_updates (
        work_order_id, action, new_status,
        new_assigned_to, actor_id, actor_role, note
    )
    VALUES (
        v_work_order_id, 'created', v_status,
        p_assigned_to, p_actor, v_actor_role,
        'Work order created'
    );

    -- If the report has no department, assign the selected one.
    -- If already assigned, the department was validated above.
    UPDATE public.reports
    SET assigned_department_id = p_department_id,
        status = CASE
            WHEN p_assigned_to IS NOT NULL THEN 'assigned'
            ELSE status
        END,
        status_changed_by = p_actor,
        updated_by = p_actor
    WHERE id = p_report_id;

    RETURN v_work_order_id;
END;
$$;


-- 4. Start work: assigned employee only, verified again.
CREATE OR REPLACE FUNCTION public.start_work_order(
    p_work_order_id uuid,
    p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_wo public.work_orders%ROWTYPE;
    v_role text;
    v_department uuid;
BEGIN
    IF NOT public.is_trusted_caller() THEN
        RAISE EXCEPTION 'Untrusted caller';
    END IF;

    IF p_actor IS NULL THEN
        RAISE EXCEPTION 'Actor is required';
    END IF;

    SELECT * INTO v_wo
    FROM public.work_orders
    WHERE id = p_work_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Work order not found';
    END IF;

    SELECT role, department_id
    INTO v_role, v_department
    FROM public.profiles
    WHERE id = p_actor;

    IF v_role IS DISTINCT FROM 'employee'
       OR v_department IS DISTINCT FROM v_wo.department_id
       OR v_wo.assigned_to IS DISTINCT FROM p_actor THEN
        RAISE EXCEPTION
            'Only the assigned employee of this department can start work';
    END IF;

    IF v_wo.status <> 'assigned' THEN
        RAISE EXCEPTION 'Work order must be assigned before starting';
    END IF;

    UPDATE public.work_orders
    SET status = 'in_progress',
        started_at = now()
    WHERE id = p_work_order_id;

    INSERT INTO public.work_order_updates (
        work_order_id, action, old_status, new_status,
        actor_id, actor_role, note
    )
    VALUES (
        p_work_order_id, 'started', 'assigned', 'in_progress',
        p_actor, v_role, 'Work started'
    );

    UPDATE public.reports
    SET status = 'in_progress',
        status_changed_by = p_actor,
        updated_by = p_actor
    WHERE id = v_wo.report_id;
END;
$$;


-- 5. Submit completion evidence: assigned employee only.
CREATE OR REPLACE FUNCTION public.submit_work_order_completion(
    p_work_order_id uuid,
    p_actor uuid,
    p_after_paths text[],
    p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_wo public.work_orders%ROWTYPE;
    v_role text;
    v_department uuid;
    v_path text;
BEGIN
    IF NOT public.is_trusted_caller() THEN
        RAISE EXCEPTION 'Untrusted caller';
    END IF;

    IF p_actor IS NULL THEN
        RAISE EXCEPTION 'Actor is required';
    END IF;

    SELECT * INTO v_wo
    FROM public.work_orders
    WHERE id = p_work_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Work order not found';
    END IF;

    SELECT role, department_id
    INTO v_role, v_department
    FROM public.profiles
    WHERE id = p_actor;

    IF v_role IS DISTINCT FROM 'employee'
       OR v_department IS DISTINCT FROM v_wo.department_id
       OR v_wo.assigned_to IS DISTINCT FROM p_actor THEN
        RAISE EXCEPTION
            'Only the assigned employee of this department can submit evidence';
    END IF;

    IF v_wo.status <> 'in_progress' THEN
        RAISE EXCEPTION 'Work order must be in progress';
    END IF;

    -- At least one after photo is required.
    IF p_after_paths IS NULL
       OR cardinality(p_after_paths) = 0 THEN
        RAISE EXCEPTION 'At least one after photo is required';
    END IF;

    -- Maximum 5 after photos per submission.
    IF cardinality(p_after_paths) > 5 THEN
        RAISE EXCEPTION 'A maximum of 5 after photos is allowed';
    END IF;

    FOREACH v_path IN ARRAY p_after_paths
    LOOP
        IF v_path IS NULL
           OR v_path NOT LIKE p_work_order_id::text || '/%'
        THEN
            RAISE EXCEPTION 'Invalid evidence storage path';
        END IF;

        INSERT INTO public.work_order_evidence (
            work_order_id, kind, storage_path, notes, uploaded_by
        )
        VALUES (
            p_work_order_id, 'after', v_path, p_notes, p_actor
        );
    END LOOP;

    UPDATE public.work_orders
    SET status = 'pending_verification'
    WHERE id = p_work_order_id;

    INSERT INTO public.work_order_updates (
        work_order_id, action, old_status, new_status,
        actor_id, actor_role, note
    )
    VALUES (
        p_work_order_id, 'evidence_submitted',
        'in_progress', 'pending_verification',
        p_actor, v_role, p_notes
    );

    UPDATE public.reports
    SET status = 'under_review',
        status_changed_by = p_actor,
        updated_by = p_actor
    WHERE id = v_wo.report_id;
END;
$$;


-- 6. Explicitly reject NULL review decisions.
CREATE OR REPLACE FUNCTION public.review_work_order(
    p_work_order_id uuid,
    p_actor uuid,
    p_decision text,
    p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_wo public.work_orders%ROWTYPE;
    v_actor_role text;
    v_new_status text;
    v_report_status text;
    v_action text;
BEGIN
    SELECT * INTO v_wo
    FROM public.work_orders
    WHERE id = p_work_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Work order not found';
    END IF;

    v_actor_role := public.assert_work_order_actor(
        p_actor, v_wo.department_id, true
    );

    IF v_wo.assigned_to = p_actor THEN
        RAISE EXCEPTION 'Assigned employee cannot review their own work';
    END IF;

    IF v_wo.status <> 'pending_verification' THEN
        RAISE EXCEPTION 'Work order is not awaiting verification';
    END IF;

    IF p_decision IS NULL
       OR p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Decision must be approved or rejected';
    END IF;

    IF p_decision = 'rejected'
       AND (p_note IS NULL OR btrim(p_note) = '') THEN
        RAISE EXCEPTION 'A review note is required when rejecting';
    END IF;

    IF p_decision = 'approved' THEN
        v_new_status := 'completed';
        v_report_status := 'resolved';
        v_action := 'approved';
    ELSE
        v_new_status := 'in_progress';
        v_report_status := 'in_progress';
        v_action := 'rejected';
    END IF;

    UPDATE public.work_orders
    SET status = v_new_status,
        completed_at = CASE
            WHEN p_decision = 'approved' THEN now()
            ELSE NULL
        END,
        last_review_decision = p_decision,
        reviewed_by = p_actor,
        reviewed_at = now(),
        review_note = p_note
    WHERE id = p_work_order_id;

    INSERT INTO public.work_order_updates (
        work_order_id, action, old_status, new_status,
        actor_id, actor_role, note
    )
    VALUES (
        p_work_order_id, v_action,
        'pending_verification', v_new_status,
        p_actor, v_actor_role, p_note
    );

    UPDATE public.reports
    SET status = v_report_status,
        status_changed_by = p_actor,
        updated_by = p_actor
    WHERE id = v_wo.report_id;
END;
$$;


-- 7. Keep RPC permissions restricted to service_role.
REVOKE ALL ON FUNCTION public.create_work_order(
    uuid, uuid, text, text, text, timestamptz, uuid, uuid
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.start_work_order(uuid, uuid)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_work_order_completion(
    uuid, uuid, text[], text
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.review_work_order(
    uuid, uuid, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_work_order(
    uuid, uuid, text, text, text, timestamptz, uuid, uuid
) TO service_role;

GRANT EXECUTE ON FUNCTION public.start_work_order(uuid, uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.submit_work_order_completion(
    uuid, uuid, text[], text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.review_work_order(
    uuid, uuid, text, text
) TO service_role;
