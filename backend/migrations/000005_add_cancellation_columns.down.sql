ALTER TABLE orders
    DROP COLUMN IF EXISTS cancellation_requested,
    DROP COLUMN IF EXISTS cancellation_reason,
    DROP COLUMN IF EXISTS cancellation_approved,
    DROP COLUMN IF EXISTS cancellation_response;
