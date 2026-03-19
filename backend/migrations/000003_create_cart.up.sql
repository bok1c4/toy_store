CREATE TABLE cart_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    toy_id          INTEGER NOT NULL,
    toy_name_cache  VARCHAR(255) NOT NULL,
    toy_image_cache TEXT,
    price_cache     NUMERIC(10,2) NOT NULL,
    quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, toy_id)
);

CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);
