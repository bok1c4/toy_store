CREATE TABLE orders (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status           VARCHAR(30) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','shipped','delivered','cancelled')),
    payment_status   VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (payment_status IN ('pending','paid','failed','refunded')),
    total_amount     NUMERIC(10,2) NOT NULL,
    shipping_address TEXT NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id           UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    toy_id             INTEGER NOT NULL,
    toy_name           VARCHAR(255) NOT NULL,
    toy_image_url      TEXT,
    price_at_purchase  NUMERIC(10,2) NOT NULL,
    quantity           INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
