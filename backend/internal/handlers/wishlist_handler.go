package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/bok1c4/toy_store/backend/internal/auth"
	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/bok1c4/toy_store/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/rs/zerolog/log"
)

type WishlistHandler struct {
	wishlistService *services.WishlistService
}

func NewWishlistHandler(wishlistService *services.WishlistService) *WishlistHandler {
	return &WishlistHandler{wishlistService: wishlistService}
}

// GetWishlist returns the user's wishlist with toy details
func (h *WishlistHandler) GetWishlist(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	items, err := h.wishlistService.GetWishlist(c.Request.Context(), userID.(string))
	if err != nil {
		log.Error().Err(err).Str("user_id", userID.(string)).Msg("failed to get wishlist")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get wishlist",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}

// AddToWishlist adds a toy to the user's wishlist
func (h *WishlistHandler) AddToWishlist(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	var req models.AddToWishlistRequest
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

	item, err := h.wishlistService.AddToWishlist(c.Request.Context(), userID.(string), &req)
	if err != nil {
		if errors.Is(err, services.ErrToyNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "toy not found",
				"code":  "NOT_FOUND",
			})
			return
		}
		if errors.Is(err, services.ErrWishlistItemExists) {
			c.JSON(http.StatusConflict, gin.H{
				"error": "item already in wishlist",
				"code":  "ALREADY_EXISTS",
			})
			return
		}

		log.Error().Err(err).Str("user_id", userID.(string)).Int("toy_id", req.ToyID).Msg("failed to add to wishlist")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to add to wishlist",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": item})
}

// RemoveFromWishlist removes an item from the wishlist by toy_id
func (h *WishlistHandler) RemoveFromWishlist(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	toyIDStr := c.Param("toy_id")
	if toyIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "toy_id is required",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	toyID, err := strconv.Atoi(toyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid toy_id",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	if err := h.wishlistService.RemoveFromWishlist(c.Request.Context(), userID.(string), toyID); err != nil {
		if errors.Is(err, services.ErrWishlistItemNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "item not found in wishlist",
				"code":  "NOT_FOUND",
			})
			return
		}

		log.Error().Err(err).Str("user_id", userID.(string)).Int("toy_id", toyID).Msg("failed to remove from wishlist")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to remove from wishlist",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "removed from wishlist"})
}

// CheckWishlist checks if a specific toy is in the user's wishlist
func (h *WishlistHandler) CheckWishlist(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	toyIDStr := c.Param("toy_id")
	if toyIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "toy_id is required",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	toyID, err := strconv.Atoi(toyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid toy_id",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	inWishlist, err := h.wishlistService.IsInWishlist(c.Request.Context(), userID.(string), toyID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID.(string)).Int("toy_id", toyID).Msg("failed to check wishlist")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to check wishlist",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"in_wishlist": inWishlist}})
}
