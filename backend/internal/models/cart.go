package models

import (
	"time"
)

// CartItem represents an item in a user's shopping cart
type CartItem struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	ToyID         int       `json:"toy_id"`
	ToyNameCache  string    `json:"toy_name_cache"`
	ToyImageCache string    `json:"toy_image_cache"`
	PriceCache    float64   `json:"price_cache"`
	Quantity      int       `json:"quantity"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// CartItemWithDetails includes the full toy details (fetched from external API)
type CartItemWithDetails struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	ToyID     int    `json:"toy_id"`
	Toy       Toy    `json:"toy"`
	Quantity  int    `json:"quantity"`
	UpdatedAt string `json:"updated_at"`
}

// CartResponse represents the full cart response with items and subtotal
type CartResponse struct {
	Items    []CartItemWithDetails `json:"items"`
	Subtotal float64               `json:"subtotal"`
}

// AddToCartRequest represents the request body for adding an item to cart
type AddToCartRequest struct {
	ToyID    int `json:"toy_id" validate:"required"`
	Quantity int `json:"quantity" validate:"required,min=1"`
}

// UpdateCartItemRequest represents the request body for updating cart item quantity
type UpdateCartItemRequest struct {
	Quantity int `json:"quantity" validate:"required,min=1"`
}
