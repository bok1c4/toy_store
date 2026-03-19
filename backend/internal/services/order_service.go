package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/bok1c4/toy_store/backend/internal/repository"
)

var (
	// ErrEmptyCart is returned when attempting to checkout with an empty cart
	ErrEmptyCart = errors.New("cart is empty")
	// ErrPaymentFailed is returned when payment simulation fails
	ErrPaymentFailed = errors.New("payment failed")
	// ErrOrderNotFound is returned when an order cannot be found
	ErrOrderNotFound = errors.New("order not found")
	// ErrInvalidOrderStatus is returned when an order status is invalid
	ErrInvalidOrderStatus = errors.New("invalid order status")
	// ErrCancellationNotAllowed is returned when cancellation is not allowed for this order
	ErrCancellationNotAllowed = errors.New("cancellation not allowed for this order")
	// ErrCancellationAlreadyRequested is returned when cancellation was already requested
	ErrCancellationAlreadyRequested = errors.New("cancellation already requested")
)

// OrderService handles order-related business logic
type OrderService struct {
	orderRepo      *repository.OrderRepository
	cartRepo       *repository.CartRepository
	userRepo       *repository.UserRepository
	paymentService *PaymentService
}

// NewOrderService creates a new order service
func NewOrderService(
	orderRepo *repository.OrderRepository,
	cartRepo *repository.CartRepository,
	userRepo *repository.UserRepository,
	paymentService *PaymentService,
) *OrderService {
	return &OrderService{
		orderRepo:      orderRepo,
		cartRepo:       cartRepo,
		userRepo:       userRepo,
		paymentService: paymentService,
	}
}

// Checkout processes a checkout request
// Flow:
// 1. Validate cart is not empty (outside transaction - read only)
// 2. Simulate payment (outside transaction)
// 3. BEGIN TRANSACTION
// 4. Create order record
// 5. Create all order_items (snapshot data from cart)
// 6. Clear cart
// 7. COMMIT
// 8. Return created order with items
func (s *OrderService) Checkout(ctx context.Context, userID string, req *models.CheckoutRequest) (*models.OrderWithItems, error) {
	// Step 1: Validate cart is not empty (OUTSIDE TRANSACTION)
	cartItems, err := s.cartRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to load cart: %w", err)
	}
	if len(cartItems) == 0 {
		return nil, ErrEmptyCart
	}

	// Step 2: Calculate total amount
	var totalAmount float64
	for _, item := range cartItems {
		totalAmount += item.PriceCache * float64(item.Quantity)
	}

	// Step 3: Simulate payment (OUTSIDE TRANSACTION)
	paymentResult := s.paymentService.Simulate(ctx, totalAmount, req.SimulateFailure)
	if !paymentResult.Success {
		return nil, ErrPaymentFailed
	}

	// Step 4: Prepare order items from cart data
	orderItems := make([]models.OrderItem, len(cartItems))
	for i, cartItem := range cartItems {
		orderItems[i] = models.OrderItem{
			ToyID:           cartItem.ToyID,
			ToyName:         cartItem.ToyNameCache,
			ToyImageURL:     cartItem.ToyImageCache,
			PriceAtPurchase: cartItem.PriceCache,
			Quantity:        cartItem.Quantity,
		}
	}

	// Step 5: Create order (INSIDE TRANSACTION)
	order := &models.Order{
		UserID:          userID,
		Status:          models.OrderStatusProcessing,
		PaymentStatus:   models.PaymentStatusPaid,
		TotalAmount:     totalAmount,
		ShippingAddress: req.ShippingAddress,
	}

	createdOrder, err := s.orderRepo.Create(ctx, order, orderItems)
	if err != nil {
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	// Step 6: Save shipping address to user profile for future use
	// This is done outside the transaction since it's not critical
	user, err := s.userRepo.FindByID(ctx, userID)
	if err == nil && user != nil {
		// Only update if address is different or not set
		if user.Address == nil || *user.Address != req.ShippingAddress {
			address := req.ShippingAddress
			s.userRepo.Update(ctx, userID, &models.UpdateUserRequest{
				Address: &address,
			})
		}
	}

	return createdOrder, nil
}

// GetUserOrders retrieves a user's order history with pagination
func (s *OrderService) GetUserOrders(ctx context.Context, userID string, page, perPage int) (*models.OrderListResponse, error) {
	orders, total, err := s.orderRepo.GetByUserID(ctx, userID, page, perPage)
	if err != nil {
		return nil, fmt.Errorf("failed to get orders: %w", err)
	}

	return &models.OrderListResponse{
		Data:    orders,
		Total:   total,
		Page:    page,
		PerPage: perPage,
	}, nil
}

// GetOrderByID retrieves a specific order
// If userID is nil, no user check is performed (for admin use)
func (s *OrderService) GetOrderByID(ctx context.Context, orderID string, userID *string) (*models.OrderWithItems, error) {
	order, err := s.orderRepo.GetByID(ctx, orderID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get order: %w", err)
	}
	if order == nil {
		return nil, ErrOrderNotFound
	}
	return order, nil
}

// RequestCancellation allows a user to request cancellation of an order
func (s *OrderService) RequestCancellation(ctx context.Context, orderID, userID, reason string) error {
	// Verify order exists and belongs to user
	order, err := s.orderRepo.GetByID(ctx, orderID, &userID)
	if err != nil {
		return fmt.Errorf("failed to get order: %w", err)
	}
	if order == nil {
		return ErrOrderNotFound
	}

	// Check if order can be cancelled
	if order.Status != models.OrderStatusPending && order.Status != models.OrderStatusProcessing {
		return ErrCancellationNotAllowed
	}

	if order.CancellationRequested {
		return ErrCancellationAlreadyRequested
	}

	// Submit cancellation request
	if err := s.orderRepo.RequestCancellation(ctx, orderID, userID, reason); err != nil {
		return fmt.Errorf("failed to request cancellation: %w", err)
	}

	return nil
}

// CreatePaymentIntent calculates the cart total and creates a Stripe PaymentIntent.
// Returns (clientSecret, paymentIntentID, totalAmount, error).
func (s *OrderService) CreatePaymentIntent(ctx context.Context, userID string) (string, string, float64, error) {
	cartItems, err := s.cartRepo.GetByUserID(ctx, userID)
	if err != nil {
		return "", "", 0, fmt.Errorf("failed to load cart: %w", err)
	}
	if len(cartItems) == 0 {
		return "", "", 0, ErrEmptyCart
	}

	var total float64
	for _, item := range cartItems {
		total += item.PriceCache * float64(item.Quantity)
	}

	clientSecret, piID, err := s.paymentService.CreatePaymentIntent(ctx, total)
	if err != nil {
		return "", "", 0, err
	}
	return clientSecret, piID, total, nil
}

// ConfirmCheckout verifies the Stripe PaymentIntent succeeded, then creates the order.
func (s *OrderService) ConfirmCheckout(ctx context.Context, userID, piID, shippingAddress string) (*models.OrderWithItems, error) {
	if !s.paymentService.VerifyPaymentIntent(piID) {
		return nil, ErrPaymentFailed
	}

	cartItems, err := s.cartRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to load cart: %w", err)
	}
	if len(cartItems) == 0 {
		return nil, ErrEmptyCart
	}

	var total float64
	orderItems := make([]models.OrderItem, len(cartItems))
	for i, item := range cartItems {
		total += item.PriceCache * float64(item.Quantity)
		orderItems[i] = models.OrderItem{
			ToyID:           item.ToyID,
			ToyName:         item.ToyNameCache,
			ToyImageURL:     item.ToyImageCache,
			PriceAtPurchase: item.PriceCache,
			Quantity:        item.Quantity,
		}
	}

	order := &models.Order{
		UserID:          userID,
		Status:          models.OrderStatusProcessing,
		PaymentStatus:   models.PaymentStatusPaid,
		TotalAmount:     total,
		ShippingAddress: shippingAddress,
	}

	created, err := s.orderRepo.Create(ctx, order, orderItems)
	if err != nil {
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	user, err := s.userRepo.FindByID(ctx, userID)
	if err == nil && user != nil {
		if user.Address == nil || *user.Address != shippingAddress {
			addr := shippingAddress
			s.userRepo.Update(ctx, userID, &models.UpdateUserRequest{Address: &addr})
		}
	}

	return created, nil
}

// SimulatePayment simulates a payment for testing
func (s *OrderService) SimulatePayment(ctx context.Context, amount float64, shouldFail bool) *models.PaymentResult {
	return s.paymentService.Simulate(ctx, amount, shouldFail)
}
