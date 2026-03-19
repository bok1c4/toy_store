package models

import (
	"time"
)

// OrderStatus represents the possible states of an order
type OrderStatus string

const (
	OrderStatusPending    OrderStatus = "pending"
	OrderStatusProcessing OrderStatus = "processing"
	OrderStatusShipped    OrderStatus = "shipped"
	OrderStatusDelivered  OrderStatus = "delivered"
	OrderStatusCancelled  OrderStatus = "cancelled"
)

// PaymentStatus represents the payment state
type PaymentStatus string

const (
	PaymentStatusPending  PaymentStatus = "pending"
	PaymentStatusPaid     PaymentStatus = "paid"
	PaymentStatusFailed   PaymentStatus = "failed"
	PaymentStatusRefunded PaymentStatus = "refunded"
)

// Order represents a purchase order in the system
type Order struct {
	ID                    string        `json:"id"`
	UserID                string        `json:"user_id"`
	Status                OrderStatus   `json:"status"`
	PaymentStatus         PaymentStatus `json:"payment_status"`
	TotalAmount           float64       `json:"total_amount"`
	ShippingAddress       string        `json:"shipping_address"`
	CancellationRequested bool          `json:"cancellation_requested"`
	CancellationReason    *string       `json:"cancellation_reason,omitempty"`
	CancellationApproved  *bool         `json:"cancellation_approved,omitempty"`
	CancellationResponse  *string       `json:"cancellation_response,omitempty"`
	CreatedAt             time.Time     `json:"created_at"`
	UpdatedAt             time.Time     `json:"updated_at"`
}

// OrderItem represents an item within an order (snapshot at purchase time)
type OrderItem struct {
	ID              string  `json:"id"`
	OrderID         string  `json:"order_id"`
	ToyID           int     `json:"toy_id"`
	ToyName         string  `json:"toy_name"`
	ToyImageURL     string  `json:"toy_image_url"`
	PriceAtPurchase float64 `json:"price_at_purchase"`
	Quantity        int     `json:"quantity"`
}

// OrderWithItems includes the order and its items
type OrderWithItems struct {
	Order
	Items []OrderItem `json:"items"`
}

// CheckoutRequest represents the request to create a new order
type CheckoutRequest struct {
	ShippingAddress string `json:"shipping_address" validate:"required"`
	SimulateFailure bool   `json:"simulate_failure,omitempty"` // For testing payment failures
}

// CancellationRequest represents a user's request to cancel an order
type CancellationRequest struct {
	Reason string `json:"reason" validate:"required,max=500"`
}

// CancellationResponse represents admin's response to a cancellation request
type CancellationResponse struct {
	Approved bool   `json:"approved"`
	Response string `json:"response" validate:"max=500"`
}

// PaymentResult represents the result of a payment simulation
type PaymentResult struct {
	Success       bool   `json:"success"`
	TransactionID string `json:"transaction_id"`
}

// PaymentIntentResponse is returned by POST /api/checkout/intent
type PaymentIntentResponse struct {
	ClientSecret    string  `json:"client_secret"`
	PaymentIntentID string  `json:"payment_intent_id"`
	TotalAmount     float64 `json:"total_amount"`
}

// ConfirmCheckoutRequest is sent by the frontend after Stripe confirms payment
type ConfirmCheckoutRequest struct {
	PaymentIntentID string `json:"payment_intent_id" validate:"required"`
	ShippingAddress string `json:"shipping_address" validate:"required"`
}

// OrderListResponse represents a paginated list of orders
type OrderListResponse struct {
	Data    []OrderWithItems `json:"data"`
	Total   int              `json:"total"`
	Page    int              `json:"page"`
	PerPage int              `json:"per_page"`
}

// CancellationRequestItem represents an order with pending cancellation request
type CancellationRequestItem struct {
	Order
	UserUsername string `json:"user_username"`
	UserEmail    string `json:"user_email"`
}

// CancellationListResponse represents admin view of pending cancellations
type CancellationListResponse struct {
	Data    []CancellationRequestItem `json:"data"`
	Total   int                       `json:"total"`
	Page    int                       `json:"page"`
	PerPage int                       `json:"per_page"`
}
