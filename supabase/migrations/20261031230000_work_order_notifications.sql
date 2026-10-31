
-- =========================================================
-- Work Orders: Notifications
-- =========================================================

-- Link notifications to work orders and their audit events.
ALTER TABLE public.notifications
ADD COLUMN work_order_id uuid
    REFERENCES public.work_orders(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
ADD COLUMN work_order_update_id uuid
    REFERENCES public.work_order_updates(id) ON DELETE CASCADE;

-- One notification per recipient for each work order event.
CREATE UNIQUE INDEX notifications_work_order_event_recipient_uidx
ON public.notifications(work_order_update_id, user_id)
WHERE work_order_update_id IS NOT NULL;

CREATE INDEX notifications_work_order_id_idx
ON public.notifications(work_order_id)
WHERE work_order_id IS NOT NULL;


-- Notify department managers and assigned employees
-- whenever a work order audit event is created.
CREATE OR REPLACE FUNCTION public.notify_work_order_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_department_id uuid;
    v_report_id uuid;
    v_title text;
    v_body text;
BEGIN
    SELECT department_id, report_id
    INTO v_department_id, v_report_id
    FROM public.work_orders
    WHERE id = NEW.work_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Work order not found for notification';
    END IF;

    -- On reassignment, mark the previous employee's
    -- unread assignment notifications as read.
    IF NEW.action = 'reassigned'
       AND NEW.old_assigned_to IS NOT NULL
       AND NEW.old_assigned_to IS DISTINCT FROM NEW.new_assigned_to
    THEN
        UPDATE public.notifications
        SET read = true,
            read_at = now()
        WHERE work_order_id = NEW.work_order_id
          AND user_id = NEW.old_assigned_to
          AND type = 'work_order_assigned'
          AND read = false;
    END IF;

    IF NEW.action = 'created' THEN
        v_title := 'New work order';
        v_body := 'A new work order has been created for your department.';

    ELSIF NEW.action IN ('assigned', 'reassigned') THEN
        v_title := 'Work order assigned';
        v_body := 'A work order has been assigned to you or your department.';

    ELSE
        RETURN NEW;
    END IF;

    -- Notify every manager of the work order department.
    INSERT INTO public.notifications (
        user_id,
        report_id,
        work_order_id,
        work_order_update_id,
        type,
        title,
        body
    )
    SELECT
        p.id,
        v_report_id,
        NEW.work_order_id,
        NEW.id,
        CASE
            WHEN NEW.action = 'created' THEN 'work_order_created'
            ELSE 'work_order_assigned'
        END,
        v_title,
        v_body
    FROM public.profiles AS p
    WHERE p.role = 'department_manager'
      AND p.department_id = v_department_id
    ON CONFLICT (work_order_update_id, user_id)
        WHERE work_order_update_id IS NOT NULL
    DO NOTHING;

    -- Also notify the assigned employee.
    -- This covers creation with an employee already assigned.
    IF NEW.action IN ('created', 'assigned', 'reassigned')
       AND NEW.new_assigned_to IS NOT NULL
    THEN
        INSERT INTO public.notifications (
            user_id,
            report_id,
            work_order_id,
            work_order_update_id,
            type,
            title,
            body
        )
        VALUES (
            NEW.new_assigned_to,
            v_report_id,
            NEW.work_order_id,
            NEW.id,
            'work_order_assigned',
            v_title,
            v_body
        )
        ON CONFLICT (work_order_update_id, user_id)
            WHERE work_order_update_id IS NOT NULL
        DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER work_order_updates_notify_participants
AFTER INSERT ON public.work_order_updates
FOR EACH ROW
EXECUTE FUNCTION public.notify_work_order_participants();


-- Trigger function is not directly callable by API roles.
REVOKE ALL ON FUNCTION public.notify_work_order_participants()
FROM PUBLIC, anon, authenticated, service_role;
