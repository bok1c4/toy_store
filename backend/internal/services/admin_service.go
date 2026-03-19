package services

import (
	"context"
	"fmt"
	"time"

	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/bok1c4/toy_store/backend/internal/repository"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AdminService provides analytics and cross-table admin queries.
type AdminService struct {
	db       *pgxpool.Pool
	userRepo *repository.UserRepository
}

// NewAdminService creates a new admin service.
func NewAdminService(db *pgxpool.Pool, userRepo *repository.UserRepository) *AdminService {
	return &AdminService{db: db, userRepo: userRepo}
}

// GetAnalytics runs all five analytics queries and assembles the result.
func (s *AdminService) GetAnalytics(ctx context.Context) (*models.Analytics, error) {
	analytics := &models.Analytics{
		OrdersPerDay: []models.DailyOrder{},
		TopToys:      []models.TopToy{},
	}

	// Total users
	if err := s.db.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&analytics.TotalUsers); err != nil {
		return nil, fmt.Errorf("failed to count users: %w", err)
	}

	// Total orders
	if err := s.db.QueryRow(ctx, `SELECT COUNT(*) FROM orders`).Scan(&analytics.TotalOrders); err != nil {
		return nil, fmt.Errorf("failed to count orders: %w", err)
	}

	// Total revenue (paid orders only)
	if err := s.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE payment_status = 'paid'`,
	).Scan(&analytics.TotalRevenue); err != nil {
		return nil, fmt.Errorf("failed to sum revenue: %w", err)
	}

	// Orders per day (last 30 days)
	rows, err := s.db.Query(ctx, `
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

	for rows.Next() {
		var d models.DailyOrder
		var date time.Time
		if err := rows.Scan(&date, &d.Count, &d.Revenue); err != nil {
			return nil, fmt.Errorf("failed to scan daily order: %w", err)
		}
		d.Date = date.Format("2006-01-02")
		analytics.OrdersPerDay = append(analytics.OrdersPerDay, d)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating daily orders: %w", err)
	}

	// Top 10 toys by quantity sold
	rows2, err := s.db.Query(ctx, `
		SELECT
			toy_id,
			toy_name,
			SUM(quantity) as total_sold
		FROM order_items
		GROUP BY toy_id, toy_name
		ORDER BY total_sold DESC
		LIMIT 10
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to get top toys: %w", err)
	}
	defer rows2.Close()

	for rows2.Next() {
		var t models.TopToy
		if err := rows2.Scan(&t.ToyID, &t.ToyName, &t.TotalSold); err != nil {
			return nil, fmt.Errorf("failed to scan top toy: %w", err)
		}
		analytics.TopToys = append(analytics.TopToys, t)
	}
	if err = rows2.Err(); err != nil {
		return nil, fmt.Errorf("error iterating top toys: %w", err)
	}

	return analytics, nil
}

// GetUserWithOrderCount returns a user plus the count of their orders.
func (s *AdminService) GetUserWithOrderCount(ctx context.Context, userID string) (*models.UserWithOrderCount, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to find user: %w", err)
	}
	if user == nil {
		return nil, nil
	}

	var orderCount int
	if err := s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM orders WHERE user_id = $1`, userID,
	).Scan(&orderCount); err != nil {
		return nil, fmt.Errorf("failed to count user orders: %w", err)
	}

	return &models.UserWithOrderCount{
		User:       *user,
		OrderCount: orderCount,
	}, nil
}
