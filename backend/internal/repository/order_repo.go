package repository

import (
	"context"
	"fmt"

	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// OrderRepository handles database operations for orders
type OrderRepository struct {
	db *pgxpool.Pool
}

// NewOrderRepository creates a new order repository
func NewOrderRepository(db *pgxpool.Pool) *OrderRepository {
	return &OrderRepository{db: db}
}

// Create creates a new order with items and clears the cart in a single transaction
func (r *OrderRepository) Create(ctx context.Context, order *models.Order, items []models.OrderItem) (*models.OrderWithItems, error) {
	// Start transaction
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	// Ensure rollback on error
	defer func() {
		if err != nil {
			tx.Rollback(ctx)
		}
	}()

	// 1. Insert order
	order.ID = uuid.New().String()
	orderQuery := `
		INSERT INTO orders (id, user_id, status, payment_status, total_amount, shipping_address, cancellation_requested, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		RETURNING id, user_id, status, payment_status, total_amount, shipping_address, cancellation_requested, cancellation_reason, cancellation_approved, cancellation_response, created_at, updated_at
	`

	var createdOrder models.Order
	err = tx.QueryRow(ctx, orderQuery,
		order.ID,
		order.UserID,
		order.Status,
		order.PaymentStatus,
		order.TotalAmount,
		order.ShippingAddress,
		false, // cancellation_requested
	).Scan(
		&createdOrder.ID,
		&createdOrder.UserID,
		&createdOrder.Status,
		&createdOrder.PaymentStatus,
		&createdOrder.TotalAmount,
		&createdOrder.ShippingAddress,
		&createdOrder.CancellationRequested,
		&createdOrder.CancellationReason,
		&createdOrder.CancellationApproved,
		&createdOrder.CancellationResponse,
		&createdOrder.CreatedAt,
		&createdOrder.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	// 2. Insert order items
	createdItems := make([]models.OrderItem, len(items))
	for i, item := range items {
		item.ID = uuid.New().String()
		item.OrderID = createdOrder.ID

		itemQuery := `
			INSERT INTO order_items (id, order_id, toy_id, toy_name, toy_image_url, price_at_purchase, quantity)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING id, order_id, toy_id, toy_name, toy_image_url, price_at_purchase, quantity
		`

		var createdItem models.OrderItem
		err = tx.QueryRow(ctx, itemQuery,
			item.ID,
			item.OrderID,
			item.ToyID,
			item.ToyName,
			item.ToyImageURL,
			item.PriceAtPurchase,
			item.Quantity,
		).Scan(
			&createdItem.ID,
			&createdItem.OrderID,
			&createdItem.ToyID,
			&createdItem.ToyName,
			&createdItem.ToyImageURL,
			&createdItem.PriceAtPurchase,
			&createdItem.Quantity,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create order item: %w", err)
		}
		createdItems[i] = createdItem
	}

	// 3. Clear user's cart
	clearCartQuery := `DELETE FROM cart_items WHERE user_id = $1`
	_, err = tx.Exec(ctx, clearCartQuery, order.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to clear cart: %w", err)
	}

	// Commit transaction
	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &models.OrderWithItems{
		Order: createdOrder,
		Items: createdItems,
	}, nil
}

// GetByUserID retrieves orders for a specific user with pagination
func (r *OrderRepository) GetByUserID(ctx context.Context, userID string, page, perPage int) ([]models.OrderWithItems, int, error) {
	// Get total count
	countQuery := `SELECT COUNT(*) FROM orders WHERE user_id = $1`
	var total int
	err := r.db.QueryRow(ctx, countQuery, userID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count orders: %w", err)
	}

	// Get orders
	offset := (page - 1) * perPage
	ordersQuery := `
		SELECT id, user_id, status, payment_status, total_amount, shipping_address, 
		       cancellation_requested, cancellation_reason, cancellation_approved, cancellation_response,
		       created_at, updated_at
		FROM orders
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, ordersQuery, userID, perPage, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get orders: %w", err)
	}
	defer rows.Close()

	orders := []models.OrderWithItems{}
	for rows.Next() {
		var order models.Order
		err := rows.Scan(
			&order.ID,
			&order.UserID,
			&order.Status,
			&order.PaymentStatus,
			&order.TotalAmount,
			&order.ShippingAddress,
			&order.CancellationRequested,
			&order.CancellationReason,
			&order.CancellationApproved,
			&order.CancellationResponse,
			&order.CreatedAt,
			&order.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan order: %w", err)
		}

		// Get items for this order
		items, err := r.getOrderItems(ctx, order.ID)
		if err != nil {
			return nil, 0, err
		}

		orders = append(orders, models.OrderWithItems{
			Order: order,
			Items: items,
		})
	}

	if err = rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating orders: %w", err)
	}

	return orders, total, nil
}

// GetByID retrieves a single order by ID
// If userID is provided, verifies the order belongs to that user
func (r *OrderRepository) GetByID(ctx context.Context, orderID string, userID *string) (*models.OrderWithItems, error) {
	orderQuery := `
		SELECT id, user_id, status, payment_status, total_amount, shipping_address,
		       cancellation_requested, cancellation_reason, cancellation_approved, cancellation_response,
		       created_at, updated_at
		FROM orders
		WHERE id = $1
	`
	args := []interface{}{orderID}

	if userID != nil {
		orderQuery += " AND user_id = $2"
		args = append(args, *userID)
	}

	var order models.Order
	err := r.db.QueryRow(ctx, orderQuery, args...).Scan(
		&order.ID,
		&order.UserID,
		&order.Status,
		&order.PaymentStatus,
		&order.TotalAmount,
		&order.ShippingAddress,
		&order.CancellationRequested,
		&order.CancellationReason,
		&order.CancellationApproved,
		&order.CancellationResponse,
		&order.CreatedAt,
		&order.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get order: %w", err)
	}

	items, err := r.getOrderItems(ctx, order.ID)
	if err != nil {
		return nil, err
	}

	return &models.OrderWithItems{
		Order: order,
		Items: items,
	}, nil
}

// getOrderItems retrieves items for a specific order
func (r *OrderRepository) getOrderItems(ctx context.Context, orderID string) ([]models.OrderItem, error) {
	query := `
		SELECT id, order_id, toy_id, toy_name, toy_image_url, price_at_purchase, quantity
		FROM order_items
		WHERE order_id = $1
	`

	rows, err := r.db.Query(ctx, query, orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to get order items: %w", err)
	}
	defer rows.Close()

	items := []models.OrderItem{}
	for rows.Next() {
		var item models.OrderItem
		err := rows.Scan(
			&item.ID,
			&item.OrderID,
			&item.ToyID,
			&item.ToyName,
			&item.ToyImageURL,
			&item.PriceAtPurchase,
			&item.Quantity,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan order item: %w", err)
		}
		items = append(items, item)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating order items: %w", err)
	}

	return items, nil
}

// RequestCancellation allows a user to request order cancellation
func (r *OrderRepository) RequestCancellation(ctx context.Context, orderID, userID, reason string) error {
	query := `
		UPDATE orders
		SET cancellation_requested = true,
		    cancellation_reason = $1,
		    updated_at = NOW()
		WHERE id = $2 AND user_id = $3 AND status IN ('pending', 'processing')
		  AND NOT cancellation_requested
	`

	result, err := r.db.Exec(ctx, query, reason, orderID, userID)
	if err != nil {
		return fmt.Errorf("failed to request cancellation: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("order not found, not eligible for cancellation, or already requested")
	}

	return nil
}

// RespondToCancellation allows admin to approve or decline cancellation
func (r *OrderRepository) RespondToCancellation(ctx context.Context, orderID string, approved bool, response string) error {
	status := string(models.OrderStatusCancelled)
	if !approved {
		status = "" // Keep original status if declined
	}

	query := `
		UPDATE orders
		SET cancellation_approved = $1,
		    cancellation_response = $2,
		    status = CASE WHEN $1 THEN $3 ELSE status END,
		    updated_at = NOW()
		WHERE id = $4 AND cancellation_requested = true AND cancellation_approved IS NULL
	`

	result, err := r.db.Exec(ctx, query, approved, response, status, orderID)
	if err != nil {
		return fmt.Errorf("failed to respond to cancellation: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("order not found or not pending cancellation")
	}

	return nil
}

// GetCancellationRequests retrieves pending cancellation requests (for admin)
func (r *OrderRepository) GetCancellationRequests(ctx context.Context, page, perPage int) ([]models.CancellationRequestItem, int, error) {
	// Get total count
	countQuery := `
		SELECT COUNT(*) 
		FROM orders o
		JOIN users u ON o.user_id = u.id
		WHERE o.cancellation_requested = true AND o.cancellation_approved IS NULL
	`
	var total int
	err := r.db.QueryRow(ctx, countQuery).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count cancellation requests: %w", err)
	}

	// Get requests with user info
	offset := (page - 1) * perPage
	query := `
		SELECT o.id, o.user_id, o.status, o.payment_status, o.total_amount, o.shipping_address,
		       o.cancellation_requested, o.cancellation_reason, o.cancellation_approved, o.cancellation_response,
		       o.created_at, o.updated_at,
		       u.username, u.email
		FROM orders o
		JOIN users u ON o.user_id = u.id
		WHERE o.cancellation_requested = true AND o.cancellation_approved IS NULL
		ORDER BY o.created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Query(ctx, query, perPage, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get cancellation requests: %w", err)
	}
	defer rows.Close()

	requests := []models.CancellationRequestItem{}
	for rows.Next() {
		var req models.CancellationRequestItem
		err := rows.Scan(
			&req.ID,
			&req.UserID,
			&req.Status,
			&req.PaymentStatus,
			&req.TotalAmount,
			&req.ShippingAddress,
			&req.CancellationRequested,
			&req.CancellationReason,
			&req.CancellationApproved,
			&req.CancellationResponse,
			&req.CreatedAt,
			&req.UpdatedAt,
			&req.UserUsername,
			&req.UserEmail,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan cancellation request: %w", err)
		}
		requests = append(requests, req)
	}

	if err = rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating cancellation requests: %w", err)
	}

	return requests, total, nil
}

// ListAll returns a paginated list of all orders for admin, optionally filtered by status.
func (r *OrderRepository) ListAll(ctx context.Context, status string, page, perPage int) ([]models.OrderWithItems, int, error) {
	offset := (page - 1) * perPage

	var total int
	var err error
	if status != "" {
		err = r.db.QueryRow(ctx, `SELECT COUNT(*) FROM orders WHERE status = $1`, status).Scan(&total)
	} else {
		err = r.db.QueryRow(ctx, `SELECT COUNT(*) FROM orders`).Scan(&total)
	}
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count orders: %w", err)
	}

	const baseQuery = `
		SELECT id, user_id, status, payment_status, total_amount, shipping_address,
		       cancellation_requested, cancellation_reason, cancellation_approved, cancellation_response,
		       created_at, updated_at
		FROM orders
	`
	var rows pgx.Rows
	if status != "" {
		rows, err = r.db.Query(ctx, baseQuery+` WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
			status, perPage, offset)
	} else {
		rows, err = r.db.Query(ctx, baseQuery+` ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
			perPage, offset)
	}
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list orders: %w", err)
	}
	defer rows.Close()

	orders := []models.OrderWithItems{}
	for rows.Next() {
		var order models.Order
		if err := rows.Scan(
			&order.ID, &order.UserID, &order.Status, &order.PaymentStatus,
			&order.TotalAmount, &order.ShippingAddress,
			&order.CancellationRequested, &order.CancellationReason,
			&order.CancellationApproved, &order.CancellationResponse,
			&order.CreatedAt, &order.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan order: %w", err)
		}
		items, err := r.getOrderItems(ctx, order.ID)
		if err != nil {
			return nil, 0, err
		}
		orders = append(orders, models.OrderWithItems{Order: order, Items: items})
	}
	if err = rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating orders: %w", err)
	}

	return orders, total, nil
}

// UpdateStatus updates the order status (for admin)
func (r *OrderRepository) UpdateStatus(ctx context.Context, orderID string, status models.OrderStatus) error {
	query := `
		UPDATE orders
		SET status = $1, updated_at = NOW()
		WHERE id = $2
	`

	result, err := r.db.Exec(ctx, query, status, orderID)
	if err != nil {
		return fmt.Errorf("failed to update order status: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("order not found")
	}

	return nil
}
