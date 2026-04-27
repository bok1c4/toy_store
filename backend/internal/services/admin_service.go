package services

import (
	"context"
	"fmt"

	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/bok1c4/toy_store/backend/internal/repository"
)

// AdminService provides analytics and cross-table admin queries.
type AdminService struct {
	adminRepo *repository.AdminRepository
	userRepo  *repository.UserRepository
}

// NewAdminService creates a new admin service.
func NewAdminService(adminRepo *repository.AdminRepository, userRepo *repository.UserRepository) *AdminService {
	return &AdminService{adminRepo: adminRepo, userRepo: userRepo}
}

// GetAnalytics runs all five analytics queries and assembles the result.
func (s *AdminService) GetAnalytics(ctx context.Context) (*models.Analytics, error) {
	totalUsers, err := s.adminRepo.CountUsers(ctx)
	if err != nil {
		return nil, err
	}

	totalOrders, err := s.adminRepo.CountOrders(ctx)
	if err != nil {
		return nil, err
	}

	totalRevenue, err := s.adminRepo.SumPaidRevenue(ctx)
	if err != nil {
		return nil, err
	}

	ordersPerDay, err := s.adminRepo.OrdersPerDayLast30(ctx)
	if err != nil {
		return nil, err
	}

	topToys, err := s.adminRepo.TopToys(ctx, 10)
	if err != nil {
		return nil, err
	}

	return &models.Analytics{
		TotalUsers:   totalUsers,
		TotalOrders:  totalOrders,
		TotalRevenue: totalRevenue,
		OrdersPerDay: ordersPerDay,
		TopToys:      topToys,
	}, nil
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

	orderCount, err := s.adminRepo.CountOrdersForUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &models.UserWithOrderCount{
		User:       *user,
		OrderCount: orderCount,
	}, nil
}
