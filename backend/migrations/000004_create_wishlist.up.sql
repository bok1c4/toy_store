CREATE TABLE wishlist_items (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    toy_id     INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, toy_id)
);

CREATE INDEX idx_wishlist_user_id ON wishlist_items(user_id);
