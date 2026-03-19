package repository

import (
	"context"
	"fmt"

	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type WishlistRepository struct {
	db *pgxpool.Pool
}

func NewWishlistRepository(db *pgxpool.Pool) *WishlistRepository {
	return &WishlistRepository{db: db}
}

// GetByUserID retrieves all wishlist items for a user
func (r *WishlistRepository) GetByUserID(ctx context.Context, userID string) ([]models.WishlistItem, error) {
	query := `
		SELECT id, user_id, toy_id, created_at
		FROM wishlist_items
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get wishlist items: %w", err)
	}
	defer rows.Close()

	var items []models.WishlistItem
	for rows.Next() {
		var item models.WishlistItem
		err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.ToyID,
			&item.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan wishlist item: %w", err)
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating wishlist items: %w", err)
	}

	return items, nil
}

// Create adds a new item to the wishlist
func (r *WishlistRepository) Create(ctx context.Context, item *models.WishlistItem) (*models.WishlistItem, error) {
	query := `
		INSERT INTO wishlist_items (id, user_id, toy_id, created_at)
		VALUES ($1, $2, $3, NOW())
		RETURNING id, user_id, toy_id, created_at
	`

	item.ID = uuid.New().String()

	var result models.WishlistItem
	err := r.db.QueryRow(ctx, query,
		item.ID,
		item.UserID,
		item.ToyID,
	).Scan(
		&result.ID,
		&result.UserID,
		&result.ToyID,
		&result.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create wishlist item: %w", err)
	}

	return &result, nil
}

// DeleteByToyID removes a wishlist item by toy_id for a specific user
func (r *WishlistRepository) DeleteByToyID(ctx context.Context, userID string, toyID int) error {
	query := `
		DELETE FROM wishlist_items
		WHERE user_id = $1 AND toy_id = $2
	`

	result, err := r.db.Exec(ctx, query, userID, toyID)
	if err != nil {
		return fmt.Errorf("failed to delete wishlist item: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("wishlist item not found")
	}

	return nil
}

// Exists checks if a toy is already in the user's wishlist
func (r *WishlistRepository) Exists(ctx context.Context, userID string, toyID int) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM wishlist_items
			WHERE user_id = $1 AND toy_id = $2
		)
	`

	var exists bool
	err := r.db.QueryRow(ctx, query, userID, toyID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check wishlist existence: %w", err)
	}

	return exists, nil
}
