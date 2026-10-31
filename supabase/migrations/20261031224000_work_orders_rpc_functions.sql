
-- =========================================================
-- Work Orders: Secure backend RPC functions
-- Only trusted service_role callers may execute these RPCs.
-- The backend must verify the user's JWT before passing p_actor.
-- =========================================================


-- 1. Internal actor authorization helper
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
BEGIN
    IF NOT public.is_trusted_caller() THEN
        RAISE EXCEPTION 'Untrusted caller';
    END IF;

    SELECT role, department_id
    INTO v_role, v_department_id
    FROM public.profiles
    WHERE id = p_actor;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Actor profile not found';
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


-- 2. Create a work order
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
BEGIN
    PERFORM public.assert_work_order_actor(
        p_actor, p_department_id, true
    );

    IF p_title IS NULL OR btrim(p_title) = '' THEN
        RAISE EXCEPTION 'Work order title is required';
    END IF;

    IF p_priority NOT IN ('Low', 'Medium', 'High', 'Critical') THEN
        RAISE EXCEPTION 'Invalid work order priority';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.reports WHERE id = p_report_id
    ) THEN
        RAISE EXCEPTION 'Report not found';
    END IF;

    IF p_assigned_to IS NOT NULL THEN
        PERFORM 1
        FROM public.profiles
        WHERE id = p_assigned_to
          AND role = 'employee'
          AND department_id = p_department_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Assigned employee must belong to this department';
        END IF;

        v_status := 'assigned';
    ELSE
        v_status := 'pending';
    END IF;

    INSERT INTO public.work_orders (
        report_id,
        department_id,
        assigned_to,
        title,
        description,
        priority,
        status,
        target_completion_at,
        created_by
    )
    VALUES (
        p_report_id,
        p_department_id,
        p_assigned_to,
        p_title,
        p_description,
        p_priority,
        v_status,
        p_target_at,
        p_actor
    )
    RETURNING id INTO v_work_order_id;

    INSERT INTO public.work_order_updates (
        work_order_id,
        action,
        new_status,
        new_assigned_to,
        actor_id,
        actor_role,
        note
    )
    VALUES (
        v_work_order_id,
        'created',
        v_status,
        p_assigned_to,
        p_actor,
        (SELECT role FROM public.profiles WHERE id = p_actor),
        'Work order created'
    );

    IF p_assigned_to IS NOT NULL THEN
        UPDATE public.reports
        SET status = 'assigned',
            status_changed_by = p_actor,
            updated_by = p_actor
        WHERE id = p_report_id;
    END IF;

    RETURN v_work_order_id;
END;
$$;


-- 3. Assign or reassign a work order
CREATE OR REPLACE FUNCTION public.assign_work_order(
    p_work_order_id uuid,
    p_assigned_to uuid,
    p_actor uuid,
    p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_wo public.work_orders%ROWTYPE;
    v_old_assignee uuid;
    v_old_status text;
    v_action text;
BEGIN
    SELECT * INTO v_wo
    FROM public.work_orders
    WHERE id = p_work_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Work order not found';
    END IF;

    PERFORM public.assert_work_order_actor(
        p_actor, v_wo.department_id, true
    );

    IF v_wo.status NOT IN ('pending', 'assigned') THEN
        RAISE EXCEPTION 'Work order cannot be assigned in its current status';
    END IF;

    PERFORM 1
    FROM public.profiles
    WHERE id = p_assigned_to
      AND role = 'employee'
      AND department_id = v_wo.department_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assigned employee must belong to this department';
    END IF;

    v_old_assignee := v_wo.assigned_to;
    v_old_status := v_wo.status;

    IF v_old_assignee IS NULL THEN
        v_action := 'assigned';
    ELSE
        v_action := 'reassigned';
    END IF;

    UPDATE public.work_orders
    SET assigned_to = p_assigned_to,
        status = 'assigned'
    WHERE id = p_work_order_id;

    INSERT INTO public.work_order_updates (
        work_order_id,
        action,
        old_status,
        new_status,
        old_assigned_to,
        new_assigned_to,
        actor_id,
        actor_role,
        note
    )
    VALUES (
        p_work_order_id,
        v_action,
        v_old_status,
        'assigned',
        v_old_assignee,
        p_assigned_to,
        p_actor,
        (SELECT role FROM public.profiles WHERE id = p_actor),
        p_note
    );

    UPDATE public.reports
    SET status = 'assigned',
        status_changed_by = p_actor,
        updated_by = p_actor
    WHERE id = v_wo.report_id;
END;
$$;


-- 4. Start work (assigned employee only)
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
BEGIN
    SELECT * INTO v_wo
    FROM public.work_orders
    WHERE id = p_work_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Work order not found';
    END IF;

    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = p_actor;

    IF v_role <> 'employee'
       OR v_wo.assigned_to IS DISTINCT FROM p_actor THEN
        RAISE EXCEPTION 'Only the assigned employee can start this work order';
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


-- 5. Submit completion evidence
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
    v_path text;
BEGIN
    SELECT * INTO v_wo
    FROM public.work_orders
    WHERE id = p_work_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Work order not found';
    END IF;

    IF v_wo.assigned_to IS DISTINCT FROM p_actor THEN
        RAISE EXCEPTION 'Only the assigned employee can submit completion';
    END IF;

    IF v_wo.status <> 'in_progress' THEN
        RAISE EXCEPTION 'Work order must be in progress';
    END IF;

    IF p_after_paths IS NULL
       OR cardinality(p_after_paths) = 0 THEN
        RAISE EXCEPTION 'At least one after photo is required';
    END IF;

    FOREACH v_path IN ARRAY p_after_paths
    LOOP
        IF v_path IS NULL
           OR v_path NOT LIKE p_work_order_id::text || '/%' THEN
            RAISE EXCEPTION 'Invalid evidence storage path';
        END IF;

        INSERT INTO public.work_order_evidence (
            work_order_id,
            kind,
            storage_path,
            notes,
            uploaded_by
        )
        VALUES (
            p_work_order_id,
            'after',
            v_path,
            p_notes,
            p_actor
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
        p_actor, 'employee', p_notes
    );

    UPDATE public.reports
    SET status = 'under_review',
        status_changed_by = p_actor,
        updated_by = p_actor
    WHERE id = v_wo.report_id;
END;
$$;


-- 6. Approve or reject completion
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

    IF p_decision NOT IN ('approved', 'rejected') THEN
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


-- 7. Cancel a work order
CREATE OR REPLACE FUNCTION public.cancel_work_order(
    p_work_order_id uuid,
    p_actor uuid,
    p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_wo public.work_orders%ROWTYPE;
    v_actor_role text;
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

    IF v_wo.status NOT IN ('pending', 'assigned', 'in_progress') THEN
        RAISE EXCEPTION 'Work order cannot be cancelled in its current status';
    END IF;

    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION 'Cancellation reason is required';
    END IF;

    UPDATE public.work_orders
    SET status = 'cancelled',
        cancellation_reason = p_reason
    WHERE id = p_work_order_id;

    INSERT INTO public.work_order_updates (
        work_order_id, action, old_status, new_status,
        old_assigned_to, new_assigned_to,
        actor_id, actor_role, note
    )
    VALUES (
        p_work_order_id, 'cancelled',
        v_wo.status, 'cancelled',
        v_wo.assigned_to, v_wo.assigned_to,
        p_actor, v_actor_role, p_reason
    );

    -- The report status intentionally remains unchanged.
END;
$$;


-- 8. Restrict RPC execution to service_role
REVOKE ALL ON FUNCTION public.assert_work_order_actor(uuid, uuid, boolean)
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_work_order(uuid, uuid, text, text, text, timestamptz, uuid, uuid)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.assign_work_order(uuid, uuid, uuid, text)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.start_work_order(uuid, uuid)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_work_order_completion(uuid, uuid, text[], text)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.review_work_order(uuid, uuid, text, text)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.cancel_work_order(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_work_order(uuid, uuid, text, text, text, timestamptz, uuid, uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.assign_work_order(uuid, uuid, uuid, text)
TO service_role;

GRANT EXECUTE ON FUNCTION public.start_work_order(uuid, uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.submit_work_order_completion(uuid, uuid, text[], text)
TO service_role;

GRANT EXECUTE ON FUNCTION public.review_work_order(uuid, uuid, text, text)
TO service_role;

GRANT EXECUTE ON FUNCTION public.cancel_work_order(uuid, uuid, text)
TO service_role;
