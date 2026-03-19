-- Remove seed data
DELETE FROM order_items WHERE order_id IN (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    'c3d4e5f6-a7b8-9012-cdef-012345678902'
);
DELETE FROM orders WHERE id IN (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    'c3d4e5f6-a7b8-9012-cdef-012345678902'
);
DELETE FROM users WHERE id IN (
    '550e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001'
);
