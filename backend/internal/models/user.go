package models

import (
	"time"
)

type UserRole string

const (
	RoleUser  UserRole = "user"
	RoleAdmin UserRole = "admin"
)

type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Role         UserRole  `json:"role"`
	AvatarURL    *string   `json:"avatar_url,omitempty"`
	Address      *string   `json:"address,omitempty"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type RegisterRequest struct {
	Username string `json:"username" validate:"required,min=3,max=50"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	User         User   `json:"user"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type UpdateUserRequest struct {
	Username  *string `json:"username,omitempty" validate:"omitempty,min=3,max=50"`
	Address   *string `json:"address,omitempty"`
	AvatarURL *string `json:"avatar_url,omitempty"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=8"`
}
