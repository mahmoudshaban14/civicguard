
-- =========================================================
-- Work Orders: Core tables
-- =========================================================

-- 1. Work Order code sequence
CREATE SEQUENCE IF NOT EXISTS public.work_order_code_seq
    START WITH 1
    INCREMENT BY 1;

-- 2. Work Orders
CREATE TABLE public.work_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    wo_code text NOT NULL UNIQUE DEFAULT (
        'WO-' ||
        to_char(current_date, 'YYYY') ||
        '-' ||
        lpad(nextval('public.work_order_code_seq'::regclass)::text, 4, '0')
    ),

    report_id uuid NOT NULL
        REFERENCES public.reports(id) ON DELETE CASCADE,

    department_id uuid NOT NULL
        REFERENCES public.departments(id) ON DELETE RESTRICT,

    assigned_to uuid
        REFERENCES auth.users(id) ON DELETE SET NULL,

    title text NOT NULL CHECK (btrim(title) <> ''),
    description text,

    priority text NOT NULL
        CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),

    status text NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'assigned',
                'in_progress',
                'pending_verification',
                'completed',
                'cancelled'
            )
        ),

    target_completion_at timestamptz,
    started_at timestamptz,
    completed_at timestamptz,

    cancellation_reason text,
    delay_reason text,

    last_review_decision text
        CHECK (
            last_review_decision IS NULL
            OR last_review_decision IN ('approved', 'rejected')
        ),

    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    review_note text,

    created_by uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE RESTRICT,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT work_orders_assignee_required
        CHECK (status IN ('pending', 'cancelled') OR assigned_to IS NOT NULL),

    CONSTRAINT work_orders_cancellation_reason_required
        CHECK (
            status <> 'cancelled'
            OR (
                cancellation_reason IS NOT NULL
                AND btrim(cancellation_reason) <> ''
            )
        ),

    CONSTRAINT work_orders_rejection_note_required
        CHECK (
            last_review_decision IS DISTINCT FROM 'rejected'
            OR (
                review_note IS NOT NULL
                AND btrim(review_note) <> ''
            )
        )
);

-- Only one active work order per report.
CREATE UNIQUE INDEX work_orders_one_active_per_report
    ON public.work_orders(report_id)
    WHERE status NOT IN ('completed', 'cancelled');

CREATE INDEX work_orders_department_status_idx
    ON public.work_orders(department_id, status);

CREATE INDEX work_orders_assignee_status_idx
    ON public.work_orders(assigned_to, status);

CREATE INDEX work_orders_report_id_idx
    ON public.work_orders(report_id);


-- 3. Work Order Evidence
CREATE TABLE public.work_order_evidence (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    work_order_id uuid NOT NULL
        REFERENCES public.work_orders(id) ON DELETE CASCADE,

    kind text NOT NULL
        CHECK (kind IN ('after', 'additional')),

    storage_path text NOT NULL UNIQUE,

    notes text,

    uploaded_by uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE RESTRICT,

    uploaded_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT work_order_evidence_path_prefix
        CHECK (
            storage_path LIKE work_order_id::text || '/%'
        )
);

CREATE INDEX work_order_evidence_work_order_idx
    ON public.work_order_evidence(work_order_id);


-- 4. Work Order Updates (Audit History)
CREATE TABLE public.work_order_updates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    work_order_id uuid NOT NULL
        REFERENCES public.work_orders(id) ON DELETE CASCADE,

    action text NOT NULL
        CHECK (
            action IN (
                'created',
                'assigned',
                'reassigned',
                'started',
                'evidence_submitted',
                'approved',
                'rejected',
                'cancelled',
                'delay_noted'
            )
        ),

    old_status text,
    new_status text,

    old_assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    new_assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    actor_id uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE RESTRICT,

    actor_role text NOT NULL,
    note text,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT work_order_updates_old_status_check
        CHECK (
            old_status IS NULL OR old_status IN (
                'pending', 'assigned', 'in_progress',
                'pending_verification', 'completed', 'cancelled'
            )
        ),

    CONSTRAINT work_order_updates_new_status_check
        CHECK (
            new_status IS NULL OR new_status IN (
                'pending', 'assigned', 'in_progress',
                'pending_verification', 'completed', 'cancelled'
            )
        )
);


-- 5. Make audit history append-only
CREATE OR REPLACE FUNCTION public.prevent_work_order_update_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'Work order history is append-only';
END;
$$;

CREATE TRIGGER work_order_updates_no_update_delete
BEFORE UPDATE OR DELETE ON public.work_order_updates
FOR EACH ROW
EXECUTE FUNCTION public.prevent_work_order_update_delete();

CREATE TRIGGER work_order_updates_no_truncate
BEFORE TRUNCATE ON public.work_order_updates
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_work_order_update_delete();


-- 6. Enable RLS
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_updates ENABLE ROW LEVEL SECURITY;


-- 7. Explicit privileges
REVOKE ALL ON public.work_orders FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.work_order_evidence FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.work_order_updates FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
    ON public.work_orders TO service_role;

GRANT SELECT, INSERT
    ON public.work_order_evidence TO service_role;

GRANT SELECT, INSERT
    ON public.work_order_updates TO service_role;

GRANT USAGE, SELECT
    ON SEQUENCE public.work_order_code_seq TO service_role;

-- No direct UPDATE, DELETE, or TRUNCATE on audit history.
REVOKE UPDATE, DELETE, TRUNCATE
    ON public.work_order_updates FROM PUBLIC, anon, authenticated, service_role;
