
-- =========================================================
-- Work Orders: Private evidence storage bucket
-- =========================================================

INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'work-order-evidence',
    'work-order-evidence',
    false,
    5242880,
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp'
    ]::text[]
)
ON CONFLICT (id)
DO UPDATE SET
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
