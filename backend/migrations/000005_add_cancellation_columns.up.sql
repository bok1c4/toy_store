ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS cancellation_requested BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS cancellation_reason    TEXT,
    ADD COLUMN IF NOT EXISTS cancellation_approved  BOOLEAN,
    ADD COLUMN IF NOT EXISTS cancellation_response  TEXT;
