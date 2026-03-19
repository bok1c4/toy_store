package repository

import (
	"context"
	"fmt"

	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CartRepository struct {
	db *pgxpool.Pool
}

func NewCartRepository(db *pgxpool.Pool) *CartRepository {
	return &CartRepository{db: db}
}

// GetByUserID retrieves all cart items for a user
func (r *CartRepository) GetByUserID(ctx context.Context, userID string) ([]models.CartItem, error) {
	query := `
		SELECT id, user_id, toy_id, toy_name_cache, toy_image_cache, price_cache, quantity, updated_at
		FROM cart_items
		WHERE user_id = $1
		ORDER BY updated_at DESC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get cart items: %w", err)
	}
	defer rows.Close()

	var items []models.CartItem
	for rows.Next() {
		var item models.CartItem
		err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.ToyID,
			&item.ToyNameCache,
			&item.ToyImageCache,
			&item.PriceCache,
			&item.Quantity,
			&item.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan cart item: %w", err)
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating cart items: %w", err)
	}

	return items, nil
}

// Upsert inserts a new cart item or increments quantity if already exists
func (r *CartRepository) Upsert(ctx context.Context, item *models.CartItem) (*models.CartItem, error) {
	query := `
		INSERT INTO cart_items 
			(id, user_id, toy_id, toy_name_cache, toy_image_cache, price_cache, quantity, updated_at)
		VALUES 
			($1, $2, $3, $4, $5, $6, $7, NOW())
		ON CONFLICT (user_id, toy_id) 
		DO UPDATE SET 
			quantity = cart_items.quantity + EXCLUDED.quantity,
			updated_at = NOW()
		RETURNING id, user_id, toy_id, toy_name_cache, toy_image_cache, price_cache, quantity, updated_at
	`

	item.ID = uuid.New().String()

	var result models.CartItem
	err := r.db.QueryRow(ctx, query,
		item.ID,
		item.UserID,
		item.ToyID,
		item.ToyNameCache,
		item.ToyImageCache,
		item.PriceCache,
		item.Quantity,
	).Scan(
		&result.ID,
		&result.UserID,
		&result.ToyID,
		&result.ToyNameCache,
		&result.ToyImageCache,
		&result.PriceCache,
		&result.Quantity,
		&result.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to upsert cart item: %w", err)
	}

	return &result, nil
}

// UpdateQuantity updates the quantity of a specific cart item
func (r *CartRepository) UpdateQuantity(ctx context.Context, itemID, userID string, quantity int) (*models.CartItem, error) {
	query := `
		UPDATE cart_items
		SET quantity = $3, updated_at = NOW()
		WHERE id = $1 AND user_id = $2
		RETURNING id, user_id, toy_id, toy_name_cache, toy_image_cache, price_cache, quantity, updated_at
	`

	var item models.CartItem
	err := r.db.QueryRow(ctx, query, itemID, userID, quantity).Scan(
		&item.ID,
		&item.UserID,
		&item.ToyID,
		&item.ToyNameCache,
		&item.ToyImageCache,
		&item.PriceCache,
		&item.Quantity,
		&item.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to update cart item quantity: %w", err)
	}

	return &item, nil
}

// Delete removes a specific cart item
func (r *CartRepository) Delete(ctx context.Context, itemID, userID string) error {
	query := `
		DELETE FROM cart_items
		WHERE id = $1 AND user_id = $2
	`

	result, err := r.db.Exec(ctx, query, itemID, userID)
	if err != nil {
		return fmt.Errorf("failed to delete cart item: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("cart item not found or does not belong to user")
	}

	return nil
}

// ClearByUserID removes all cart items for a user
func (r *CartRepository) ClearByUserID(ctx context.Context, userID string) error {
	query := `
		DELETE FROM cart_items
		WHERE user_id = $1
	`

	_, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to clear cart: %w", err)
	}

	return nil
}

// GetByID retrieves a single cart item by ID (used internally)
func (r *CartRepository) GetByID(ctx context.Context, itemID string) (*models.CartItem, error) {
	query := `
		SELECT id, user_id, toy_id, toy_name_cache, toy_image_cache, price_cache, quantity, updated_at
		FROM cart_items
		WHERE id = $1
	`

	var item models.CartItem
	err := r.db.QueryRow(ctx, query, itemID).Scan(
		&item.ID,
		&item.UserID,
		&item.ToyID,
		&item.ToyNameCache,
		&item.ToyImageCache,
		&item.PriceCache,
		&item.Quantity,
		&item.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get cart item by id: %w", err)
	}

	return &item, nil
}
