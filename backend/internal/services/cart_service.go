package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/bok1c4/toy_store/backend/internal/repository"
)

var (
	ErrToyNotFound      = errors.New("toy not found")
	ErrCartItemNotFound = errors.New("cart item not found")
)

type CartService struct {
	cartRepo   *repository.CartRepository
	toyService *ToyService
}

func NewCartService(cartRepo *repository.CartRepository, toyService *ToyService) *CartService {
	return &CartService{
		cartRepo:   cartRepo,
		toyService: toyService,
	}
}

// GetCart retrieves the full cart for a user with toy details and calculated subtotal
func (s *CartService) GetCart(ctx context.Context, userID string) (*models.CartResponse, error) {
	// Get cart items from database
	items, err := s.cartRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get cart items: %w", err)
	}

	if len(items) == 0 {
		return &models.CartResponse{
			Items:    []models.CartItemWithDetails{},
			Subtotal: 0,
		}, nil
	}

	// Fetch toy details for each cart item and calculate subtotal
	itemsWithDetails := make([]models.CartItemWithDetails, 0, len(items))
	var subtotal float64

	for _, item := range items {
		// Fetch current toy details from external API (may be cached)
		toy, err := s.toyService.GetByID(ctx, item.ToyID)
		if err != nil {
			// If toy is not found, use the cached data
			toy = &models.Toy{
				ID:          item.ToyID,
				Name:        item.ToyNameCache,
				Image:       item.ToyImageCache,
				Price:       int(item.PriceCache),
				Description: "",
				AgeGroup:    "",
				Type:        "",
			}
		}

		itemWithDetails := models.CartItemWithDetails{
			ID:        item.ID,
			UserID:    item.UserID,
			ToyID:     item.ToyID,
			Toy:       *toy,
			Quantity:  item.Quantity,
			UpdatedAt: item.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		}

		itemsWithDetails = append(itemsWithDetails, itemWithDetails)
		subtotal += float64(item.Quantity) * item.PriceCache
	}

	return &models.CartResponse{
		Items:    itemsWithDetails,
		Subtotal: subtotal,
	}, nil
}

// AddToCart adds a toy to the user's cart, fetching toy details for snapshot
func (s *CartService) AddToCart(ctx context.Context, userID string, req *models.AddToCartRequest) (*models.CartItem, error) {
	// Fetch toy details from external API to snapshot name/image/price
	toy, err := s.toyService.GetByID(ctx, req.ToyID)
	if err != nil {
		return nil, ErrToyNotFound
	}

	// Create cart item with snapshot data
	item := &models.CartItem{
		UserID:        userID,
		ToyID:         req.ToyID,
		ToyNameCache:  toy.Name,
		ToyImageCache: toy.Image,
		PriceCache:    float64(toy.Price),
		Quantity:      req.Quantity,
	}

	// Upsert will insert new or increment quantity if already exists
	result, err := s.cartRepo.Upsert(ctx, item)
	if err != nil {
		return nil, fmt.Errorf("failed to add to cart: %w", err)
	}

	return result, nil
}

// UpdateQuantity updates the quantity of a cart item
func (s *CartService) UpdateQuantity(ctx context.Context, userID, itemID string, req *models.UpdateCartItemRequest) (*models.CartItem, error) {
	item, err := s.cartRepo.UpdateQuantity(ctx, itemID, userID, req.Quantity)
	if err != nil {
		return nil, fmt.Errorf("failed to update cart item: %w", err)
	}

	if item == nil {
		return nil, ErrCartItemNotFound
	}

	return item, nil
}

// RemoveFromCart removes an item from the cart
func (s *CartService) RemoveFromCart(ctx context.Context, userID, itemID string) error {
	err := s.cartRepo.Delete(ctx, itemID, userID)
	if err != nil {
		// Check if it's a "not found" error
		if err.Error() == "cart item not found or does not belong to user" {
			return ErrCartItemNotFound
		}
		return fmt.Errorf("failed to remove from cart: %w", err)
	}

	return nil
}

// ClearCart removes all items from the user's cart
func (s *CartService) ClearCart(ctx context.Context, userID string) error {
	err := s.cartRepo.ClearByUserID(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to clear cart: %w", err)
	}

	return nil
}
