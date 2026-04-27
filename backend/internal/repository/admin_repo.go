package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AdminRepository owns the cross-table analytics queries used by AdminService.
type AdminRepository struct {
	db *pgxpool.Pool
}

// NewAdminRepository constructs an AdminRepository.
func NewAdminRepository(db *pgxpool.Pool) *AdminRepository {
	return &AdminRepository{db: db}
}

// CountUsers returns the total number of users.
func (r *AdminRepository) CountUsers(ctx context.Context) (int64, error) {
	var n int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&n); err != nil {
		return 0, fmt.Errorf("failed to count users: %w", err)
	}
	return n, nil
}

// CountOrders returns the total number of orders.
func (r *AdminRepository) CountOrders(ctx context.Context) (int64, error) {
	var n int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM orders`).Scan(&n); err != nil {
		return 0, fmt.Errorf("failed to count orders: %w", err)
	}
	return n, nil
}

// SumPaidRevenue returns the total revenue across paid orders.
func (r *AdminRepository) SumPaidRevenue(ctx context.Context) (float64, error) {
	var total float64
	if err := r.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE payment_status = 'paid'`,
	).Scan(&total); err != nil {
		return 0, fmt.Errorf("failed to sum revenue: %w", err)
	}
	return total, nil
}

// OrdersPerDayLast30 returns daily order counts and revenue for the last 30 days.
func (r *AdminRepository) OrdersPerDayLast30(ctx context.Context) ([]models.DailyOrder, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			DATE(created_at) as date,
			COUNT(*) as count,
			COALESCE(SUM(total_amount), 0) as revenue
		FROM orders
		WHERE created_at > NOW() - INTERVAL '30 days'
		GROUP BY DATE(created_at)
		ORDER BY date ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to get orders per day: %w", err)
	}
	defer rows.Close()

	out := []models.DailyOrder{}
	for rows.Next() {
		var d models.DailyOrder
		var date time.Time
		if err := rows.Scan(&date, &d.Count, &d.Revenue); err != nil {
			return nil, fmt.Errorf("failed to scan daily order: %w", err)
		}
		d.Date = date.Format("2006-01-02")
		out = append(out, d)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating daily orders: %w", err)
	}
	return out, nil
}

// TopToys returns the top N toys by total quantity sold.
func (r *AdminRepository) TopToys(ctx context.Context, limit int) ([]models.TopToy, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			toy_id,
			toy_name,
			SUM(quantity) as total_sold
		FROM order_items
		GROUP BY toy_id, toy_name
		ORDER BY total_sold DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get top toys: %w", err)
	}
	defer rows.Close()

	out := []models.TopToy{}
	for rows.Next() {
		var t models.TopToy
		if err := rows.Scan(&t.ToyID, &t.ToyName, &t.TotalSold); err != nil {
			return nil, fmt.Errorf("failed to scan top toy: %w", err)
		}
		out = append(out, t)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating top toys: %w", err)
	}
	return out, nil
}

// CountOrdersForUser returns how many orders the given user has placed.
func (r *AdminRepository) CountOrdersForUser(ctx context.Context, userID string) (int, error) {
	var n int
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM orders WHERE user_id = $1`, userID,
	).Scan(&n); err != nil {
		return 0, fmt.Errorf("failed to count user orders: %w", err)
	}
	return n, nil
}
