package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/bok1c4/toy_store/backend/internal/auth"
	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/bok1c4/toy_store/backend/internal/repository"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserAlreadyExists   = errors.New("user already exists")
	ErrInvalidCredentials  = errors.New("invalid credentials")
	ErrUserDisabled        = errors.New("account is disabled")
	ErrInvalidRefreshToken = errors.New("invalid refresh token")
	ErrTokenRevoked        = errors.New("token has been revoked")
)

type AuthService struct {
	userRepo    *repository.UserRepository
	jwtManager  *auth.JWTManager
	redisClient *redis.Client
}

func NewAuthService(userRepo *repository.UserRepository, jwtManager *auth.JWTManager, redisClient *redis.Client) *AuthService {
	return &AuthService{
		userRepo:    userRepo,
		jwtManager:  jwtManager,
		redisClient: redisClient,
	}
}

func (s *AuthService) Register(ctx context.Context, req *models.RegisterRequest) (*models.User, error) {
	existingUser, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing email: %w", err)
	}
	if existingUser != nil {
		return nil, ErrUserAlreadyExists
	}

	existingUser, err = s.userRepo.FindByUsername(ctx, req.Username)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing username: %w", err)
	}
	if existingUser != nil {
		return nil, ErrUserAlreadyExists
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	now := time.Now()
	user := &models.User{
		ID:           uuid.New().String(),
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Role:         models.RoleUser,
		IsActive:     true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

func (s *AuthService) Login(ctx context.Context, req *models.LoginRequest) (*models.LoginResponse, error) {
	user, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("failed to find user: %w", err)
	}
	if user == nil {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	if !user.IsActive {
		return nil, ErrUserDisabled
	}

	accessToken, err := s.jwtManager.GenerateAccessToken(user.ID, string(user.Role))
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err := s.jwtManager.GenerateRefreshToken(user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	claims, err := s.jwtManager.ValidateToken(refreshToken)
	if err != nil {
		return nil, fmt.Errorf("failed to get refresh token claims: %w", err)
	}

	refreshKey := s.jwtManager.GetRefreshTokenKey(user.ID, claims.RegisteredClaims.ID)
	if err := s.redisClient.Set(ctx, refreshKey, "valid", 168*time.Hour).Err(); err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	return &models.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         *user,
	}, nil
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	claims, err := s.jwtManager.ValidateToken(refreshToken)
	if err != nil {
		return ErrInvalidRefreshToken
	}

	if claims.Type != "refresh" {
		return ErrInvalidRefreshToken
	}

	refreshKey := s.jwtManager.GetRefreshTokenKey(claims.UserID, claims.RegisteredClaims.ID)
	deleted, err := s.redisClient.Del(ctx, refreshKey).Result()
	if err != nil {
		return fmt.Errorf("failed to delete refresh token: %w", err)
	}
	if deleted == 0 {
		return ErrTokenRevoked
	}

	return nil
}

func (s *AuthService) RefreshTokens(ctx context.Context, refreshToken string) (*models.TokenPair, error) {
	claims, err := s.jwtManager.ValidateToken(refreshToken)
	if err != nil {
		return nil, ErrInvalidRefreshToken
	}

	if claims.Type != "refresh" {
		return nil, ErrInvalidRefreshToken
	}

	refreshKey := s.jwtManager.GetRefreshTokenKey(claims.UserID, claims.RegisteredClaims.ID)
	exists, err := s.redisClient.Exists(ctx, refreshKey).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to check refresh token: %w", err)
	}
	if exists == 0 {
		return nil, ErrTokenRevoked
	}

	user, err := s.userRepo.FindByID(ctx, claims.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to find user: %w", err)
	}
	if user == nil || !user.IsActive {
		return nil, ErrUserDisabled
	}

	if err := s.redisClient.Del(ctx, refreshKey).Err(); err != nil {
		return nil, fmt.Errorf("failed to revoke old refresh token: %w", err)
	}

	accessToken, err := s.jwtManager.GenerateAccessToken(user.ID, string(user.Role))
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	newRefreshToken, err := s.jwtManager.GenerateRefreshToken(user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	newClaims, err := s.jwtManager.ValidateToken(newRefreshToken)
	if err != nil {
		return nil, fmt.Errorf("failed to get new refresh token claims: %w", err)
	}

	newRefreshKey := s.jwtManager.GetRefreshTokenKey(user.ID, newClaims.RegisteredClaims.ID)
	if err := s.redisClient.Set(ctx, newRefreshKey, "valid", 168*time.Hour).Err(); err != nil {
		return nil, fmt.Errorf("failed to store new refresh token: %w", err)
	}

	return &models.TokenPair{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
	}, nil
}

func (s *AuthService) GetUserByID(ctx context.Context, userID string) (*models.User, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to find user: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}
	return user, nil
}

func (s *AuthService) UpdateUser(ctx context.Context, userID string, req *models.UpdateUserRequest) (*models.User, error) {
	user, err := s.userRepo.Update(ctx, userID, req)
	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}
	return user, nil
}

func (s *AuthService) ChangePassword(ctx context.Context, userID string, req *models.ChangePasswordRequest) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to find user: %w", err)
	}
	if user == nil {
		return fmt.Errorf("user not found")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		return ErrInvalidCredentials
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	if err := s.userRepo.UpdatePassword(ctx, userID, string(hashedPassword)); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	return nil
}
