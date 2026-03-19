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

type CartHandler struct {
	cartService *services.CartService
}

func NewCartHandler(cartService *services.CartService) *CartHandler {
	return &CartHandler{cartService: cartService}
}

// GetCart returns the user's current cart with items and subtotal
func (h *CartHandler) GetCart(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	cart, err := h.cartService.GetCart(c.Request.Context(), userID.(string))
	if err != nil {
		log.Error().Err(err).Str("user_id", userID.(string)).Msg("failed to get cart")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get cart",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": cart})
}

// AddToCart adds a toy to the user's cart
func (h *CartHandler) AddToCart(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	var req models.AddToCartRequest
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

	item, err := h.cartService.AddToCart(c.Request.Context(), userID.(string), &req)
	if err != nil {
		if errors.Is(err, services.ErrToyNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "toy not found",
				"code":  "NOT_FOUND",
			})
			return
		}

		log.Error().Err(err).Str("user_id", userID.(string)).Int("toy_id", req.ToyID).Msg("failed to add to cart")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to add to cart",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": item})
}

// UpdateCartItem updates the quantity of a cart item
func (h *CartHandler) UpdateCartItem(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	itemID := c.Param("item_id")
	if itemID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "item_id is required",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	var req models.UpdateCartItemRequest
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

	item, err := h.cartService.UpdateQuantity(c.Request.Context(), userID.(string), itemID, &req)
	if err != nil {
		if errors.Is(err, services.ErrCartItemNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "cart item not found",
				"code":  "NOT_FOUND",
			})
			return
		}

		log.Error().Err(err).Str("user_id", userID.(string)).Str("item_id", itemID).Msg("failed to update cart item")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to update cart item",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

// RemoveFromCart removes an item from the cart
func (h *CartHandler) RemoveFromCart(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	itemID := c.Param("item_id")
	if itemID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "item_id is required",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	if err := h.cartService.RemoveFromCart(c.Request.Context(), userID.(string), itemID); err != nil {
		if errors.Is(err, services.ErrCartItemNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "cart item not found",
				"code":  "NOT_FOUND",
			})
			return
		}

		log.Error().Err(err).Str("user_id", userID.(string)).Str("item_id", itemID).Msg("failed to remove from cart")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to remove from cart",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "item removed from cart"})
}

// ClearCart removes all items from the user's cart
func (h *CartHandler) ClearCart(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	if err := h.cartService.ClearCart(c.Request.Context(), userID.(string)); err != nil {
		log.Error().Err(err).Str("user_id", userID.(string)).Msg("failed to clear cart")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to clear cart",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "cart cleared"})
}
