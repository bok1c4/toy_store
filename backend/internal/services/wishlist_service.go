package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/bok1c4/toy_store/backend/internal/repository"
)

var (
	ErrWishlistItemExists   = errors.New("item already in wishlist")
	ErrWishlistItemNotFound = errors.New("item not found in wishlist")
)

type WishlistService struct {
	wishlistRepo *repository.WishlistRepository
	toyService   *ToyService
}

func NewWishlistService(wishlistRepo *repository.WishlistRepository, toyService *ToyService) *WishlistService {
	return &WishlistService{
		wishlistRepo: wishlistRepo,
		toyService:   toyService,
	}
}

// GetWishlist retrieves the full wishlist for a user with toy details
func (s *WishlistService) GetWishlist(ctx context.Context, userID string) ([]models.WishlistItemWithDetails, error) {
	// Get wishlist items from database
	items, err := s.wishlistRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get wishlist items: %w", err)
	}

	if len(items) == 0 {
		return []models.WishlistItemWithDetails{}, nil
	}

	// Fetch toy details for each wishlist item
	itemsWithDetails := make([]models.WishlistItemWithDetails, 0, len(items))

	for _, item := range items {
		// Fetch current toy details from external API (may be cached)
		toy, err := s.toyService.GetByID(ctx, item.ToyID)
		if err != nil {
			// Skip items where toy is not found
			continue
		}

		itemWithDetails := models.WishlistItemWithDetails{
			ID:        item.ID,
			UserID:    item.UserID,
			ToyID:     item.ToyID,
			Toy:       *toy,
			CreatedAt: item.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}

		itemsWithDetails = append(itemsWithDetails, itemWithDetails)
	}

	return itemsWithDetails, nil
}

// AddToWishlist adds a toy to the user's wishlist
func (s *WishlistService) AddToWishlist(ctx context.Context, userID string, req *models.AddToWishlistRequest) (*models.WishlistItem, error) {
	// Check if item already exists in wishlist
	exists, err := s.wishlistRepo.Exists(ctx, userID, req.ToyID)
	if err != nil {
		return nil, fmt.Errorf("failed to check wishlist: %w", err)
	}

	if exists {
		return nil, ErrWishlistItemExists
	}

	// Verify toy exists by fetching it
	_, err = s.toyService.GetByID(ctx, req.ToyID)
	if err != nil {
		return nil, ErrToyNotFound
	}

	// Create wishlist item
	item := &models.WishlistItem{
		UserID: userID,
		ToyID:  req.ToyID,
	}

	result, err := s.wishlistRepo.Create(ctx, item)
	if err != nil {
		return nil, fmt.Errorf("failed to add to wishlist: %w", err)
	}

	return result, nil
}

// RemoveFromWishlist removes an item from the wishlist by toy_id
func (s *WishlistService) RemoveFromWishlist(ctx context.Context, userID string, toyID int) error {
	err := s.wishlistRepo.DeleteByToyID(ctx, userID, toyID)
	if err != nil {
		// Check if it's a "not found" error
		if err.Error() == "wishlist item not found" {
			return ErrWishlistItemNotFound
		}
		return fmt.Errorf("failed to remove from wishlist: %w", err)
	}

	return nil
}

// IsInWishlist checks if a toy is in the user's wishlist
func (s *WishlistService) IsInWishlist(ctx context.Context, userID string, toyID int) (bool, error) {
	return s.wishlistRepo.Exists(ctx, userID, toyID)
}
