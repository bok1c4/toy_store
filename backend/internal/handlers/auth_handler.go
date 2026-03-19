package handlers

import (
	"errors"
	"net/http"

	"github.com/bok1c4/toy_store/backend/internal/auth"
	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/bok1c4/toy_store/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/rs/zerolog/log"
)

type AuthHandler struct {
	authService *services.AuthService
}

func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		validationErrors, ok := err.(validator.ValidationErrors)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "invalid request body",
				"code":  "VALIDATION_ERROR",
			})
			return
		}

		fieldErrors := make(map[string]string)
		for _, e := range validationErrors {
			fieldErrors[e.Field()] = getValidationTagMessage(e)
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"error":        "validation failed",
			"code":         "VALIDATION_ERROR",
			"field_errors": fieldErrors,
		})
		return
	}

	user, err := h.authService.Register(c.Request.Context(), &req)
	if err != nil {
		if errors.Is(err, services.ErrUserAlreadyExists) {
			c.JSON(http.StatusConflict, gin.H{
				"error": "email or username already exists",
				"code":  "USER_EXISTS",
			})
			return
		}

		log.Error().Err(err).Msg("failed to register user")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to register user",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": user})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		validationErrors, ok := err.(validator.ValidationErrors)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "invalid request body",
				"code":  "VALIDATION_ERROR",
			})
			return
		}

		fieldErrors := make(map[string]string)
		for _, e := range validationErrors {
			fieldErrors[e.Field()] = getValidationTagMessage(e)
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"error":        "validation failed",
			"code":         "VALIDATION_ERROR",
			"field_errors": fieldErrors,
		})
		return
	}

	resp, err := h.authService.Login(c.Request.Context(), &req)
	if err != nil {
		if errors.Is(err, services.ErrInvalidCredentials) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "invalid email or password",
				"code":  "INVALID_CREDENTIALS",
			})
			return
		}
		if errors.Is(err, services.ErrUserDisabled) {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "account is disabled",
				"code":  "ACCOUNT_DISABLED",
			})
			return
		}

		log.Error().Err(err).Msg("failed to login")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to login",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resp})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	var req models.LogoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	if err := h.authService.Logout(c.Request.Context(), req.RefreshToken); err != nil {
		if errors.Is(err, services.ErrInvalidRefreshToken) || errors.Is(err, services.ErrTokenRevoked) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "invalid or already revoked token",
				"code":  "INVALID_TOKEN",
			})
			return
		}

		log.Error().Err(err).Msg("failed to logout")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to logout",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req models.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	tokens, err := h.authService.RefreshTokens(c.Request.Context(), req.RefreshToken)
	if err != nil {
		if errors.Is(err, services.ErrInvalidRefreshToken) || errors.Is(err, services.ErrTokenRevoked) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "invalid or expired refresh token",
				"code":  "INVALID_TOKEN",
			})
			return
		}
		if errors.Is(err, services.ErrUserDisabled) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "account is disabled",
				"code":  "ACCOUNT_DISABLED",
			})
			return
		}

		log.Error().Err(err).Msg("failed to refresh tokens")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to refresh tokens",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": tokens})
}

type UserHandler struct {
	authService *services.AuthService
}

func NewUserHandler(authService *services.AuthService) *UserHandler {
	return &UserHandler{authService: authService}
}

func (h *UserHandler) GetProfile(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	user, err := h.authService.GetUserByID(c.Request.Context(), userID.(string))
	if err != nil {
		log.Error().Err(err).Str("user_id", userID.(string)).Msg("failed to get user profile")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get profile",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": user})
}

func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	var req models.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	user, err := h.authService.UpdateUser(c.Request.Context(), userID.(string), &req)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID.(string)).Msg("failed to update user profile")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to update profile",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": user})
}

func (h *UserHandler) ChangePassword(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	var req models.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		validationErrors, ok := err.(validator.ValidationErrors)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "invalid request body",
				"code":  "VALIDATION_ERROR",
			})
			return
		}

		fieldErrors := make(map[string]string)
		for _, e := range validationErrors {
			fieldErrors[e.Field()] = getValidationTagMessage(e)
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"error":        "validation failed",
			"code":         "VALIDATION_ERROR",
			"field_errors": fieldErrors,
		})
		return
	}

	if err := h.authService.ChangePassword(c.Request.Context(), userID.(string), &req); err != nil {
		if errors.Is(err, services.ErrInvalidCredentials) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "current password is incorrect",
				"code":  "INVALID_PASSWORD",
			})
			return
		}

		log.Error().Err(err).Str("user_id", userID.(string)).Msg("failed to change password")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to change password",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "password updated"})
}
