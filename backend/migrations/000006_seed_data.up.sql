-- Seed data for development
-- Prices are in the smallest currency unit (integer), matching the toy.pequla.com API.
-- Passwords are bcrypt hashed with cost 12:
--   admin@toystore.com / admin123
--   user@toystore.com  / user123

INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, updated_at)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'admin', 'admin@toystore.com',
     '$2a$12$yOAtiR3kVeNGOEC3RIWuquDVu7ZUS83LmGiwCbo8.6fb00QJcl3b.', 'admin', true, NOW(), NOW()),
    ('550e8400-e29b-41d4-a716-446655440001', 'user',  'user@toystore.com',
     '$2a$12$cKP5uSt6bPeAAhU0aFnux..CKFWGErgY3q.mAgCi1BDx.pwyMNgEO',  'user',  true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- ─── Orders ──────────────────────────────────────────────────────────────────

-- Order 1: delivered, paid, 45 days ago
INSERT INTO orders (id, user_id, status, payment_status, total_amount, shipping_address,
                    cancellation_requested, created_at, updated_at)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '550e8400-e29b-41d4-a716-446655440001',
        'delivered', 'paid', 3897,
        'Knez Mihailova 10, 11000 Beograd, Srbija',
        false, NOW() - INTERVAL '45 days', NOW() - INTERVAL '38 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, toy_id, toy_name, toy_image_url, price_at_purchase, quantity)
VALUES
    ('a1b2c3d4-0001-0001-0001-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
     1, 'Drvena slagalica životinje', 'https://toy.pequla.com/img/1.png', 1499, 2),
    ('a1b2c3d4-0002-0002-0002-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
     2, 'Mala slikovnica boje',       'https://toy.pequla.com/img/2.png',  899, 1)
ON CONFLICT (id) DO NOTHING;

-- Order 2: delivered, paid, 20 days ago
INSERT INTO orders (id, user_id, status, payment_status, total_amount, shipping_address,
                    cancellation_requested, created_at, updated_at)
VALUES ('b2c3d4e5-f6a7-8901-bcde-f12345678901', '550e8400-e29b-41d4-a716-446655440001',
        'delivered', 'paid', 4198,
        'Terazije 5, 11000 Beograd, Srbija',
        false, NOW() - INTERVAL '20 days', NOW() - INTERVAL '14 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, toy_id, toy_name, toy_image_url, price_at_purchase, quantity)
VALUES
    ('b2c3d4e5-0001-0001-0001-000000000001', 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
     3, 'Superheroj figura', 'https://toy.pequla.com/img/3.png', 1899, 1),
    ('b2c3d4e5-0002-0002-0002-000000000002', 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
     5, 'Vatrogasni kamion', 'https://toy.pequla.com/img/5.png', 2299, 1)
ON CONFLICT (id) DO NOTHING;

-- Order 3: delivered, paid, 10 days ago
INSERT INTO orders (id, user_id, status, payment_status, total_amount, shipping_address,
                    cancellation_requested, created_at, updated_at)
VALUES ('c3d4e5f6-a7b8-9012-cdef-012345678902', '550e8400-e29b-41d4-a716-446655440001',
        'delivered', 'paid', 3597,
        'Bulevar Kralja Aleksandra 15, 11000 Beograd, Srbija',
        false, NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, toy_id, toy_name, toy_image_url, price_at_purchase, quantity)
VALUES
    ('c3d4e5f6-0001-0001-0001-000000000001', 'c3d4e5f6-a7b8-9012-cdef-012345678902',
     4, 'Set za crtanje', 'https://toy.pequla.com/img/4.png', 1199, 3)
ON CONFLICT (id) DO NOTHING;

-- Order 4: shipped, paid, 3 days ago
INSERT INTO orders (id, user_id, status, payment_status, total_amount, shipping_address,
                    cancellation_requested, created_at, updated_at)
VALUES ('d4e5f6a7-b8c9-0123-defa-123456789012', '550e8400-e29b-41d4-a716-446655440001',
        'shipped', 'paid', 4999,
        'Vojvode Stepe 100, 11000 Beograd, Srbija',
        false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, toy_id, toy_name, toy_image_url, price_at_purchase, quantity)
VALUES
    ('d4e5f6a7-0001-0001-0001-000000000001', 'd4e5f6a7-b8c9-0123-defa-123456789012',
     8, 'LEGO Classic set', 'https://toy.pequla.com/img/8.png', 4999, 1)
ON CONFLICT (id) DO NOTHING;

-- Order 5: processing, paid, cancellation pending
INSERT INTO orders (id, user_id, status, payment_status, total_amount, shipping_address,
                    cancellation_requested, cancellation_reason, created_at, updated_at)
VALUES ('e5f6a7b8-c9d0-1234-efab-234567890123', '550e8400-e29b-41d4-a716-446655440001',
        'processing', 'paid', 6998,
        'Nemanjina 22, 11000 Beograd, Srbija',
        true, 'Pogrešno sam odabrao veličinu, molim za otkazivanje.',
        NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, toy_id, toy_name, toy_image_url, price_at_purchase, quantity)
VALUES
    ('e5f6a7b8-0001-0001-0001-000000000001', 'e5f6a7b8-c9d0-1234-efab-234567890123',
     7, 'Monopol Junior', 'https://toy.pequla.com/img/7.png', 3499, 2)
ON CONFLICT (id) DO NOTHING;

-- ─── Cart items (current shopping session for user) ──────────────────────────

INSERT INTO cart_items (user_id, toy_id, toy_name_cache, toy_image_cache, price_cache, quantity, updated_at)
VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 6,  'Plišana panda',       'https://toy.pequla.com/img/6.png',  1599, 1, NOW()),
    ('550e8400-e29b-41d4-a716-446655440001', 10, 'Pametni globus',       'https://toy.pequla.com/img/10.png', 6799, 1, NOW()),
    ('550e8400-e29b-41d4-a716-446655440001', 20, 'Edukativni mikroskop', 'https://toy.pequla.com/img/20.png', 4999, 2, NOW())
ON CONFLICT (user_id, toy_id) DO NOTHING;

-- ─── Wishlist ────────────────────────────────────────────────────────────────

INSERT INTO wishlist_items (user_id, toy_id, created_at)
VALUES
    ('550e8400-e29b-41d4-a716-446655440001',  9, NOW() - INTERVAL '7 days'),
    ('550e8400-e29b-41d4-a716-446655440001', 16, NOW() - INTERVAL '5 days'),
    ('550e8400-e29b-41d4-a716-446655440001', 25, NOW() - INTERVAL '3 days'),
    ('550e8400-e29b-41d4-a716-446655440001', 30, NOW() - INTERVAL '1 day')
ON CONFLICT (user_id, toy_id) DO NOTHING;
