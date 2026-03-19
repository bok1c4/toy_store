package models

import (
	"time"
)

// WishlistItem represents an item in a user's wishlist
type WishlistItem struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	ToyID     int       `json:"toy_id"`
	CreatedAt time.Time `json:"created_at"`
}

// WishlistItemWithDetails includes the full toy details (fetched from external API)
type WishlistItemWithDetails struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	ToyID     int    `json:"toy_id"`
	Toy       Toy    `json:"toy"`
	CreatedAt string `json:"created_at"`
}

// AddToWishlistRequest represents the request body for adding an item to wishlist
type AddToWishlistRequest struct {
	ToyID int `json:"toy_id" validate:"required"`
}
