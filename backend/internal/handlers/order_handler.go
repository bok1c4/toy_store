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

// OrderHandler handles order-related HTTP requests
type OrderHandler struct {
	orderService *services.OrderService
}

// NewOrderHandler creates a new order handler
func NewOrderHandler(orderService *services.OrderService) *OrderHandler {
	return &OrderHandler{orderService: orderService}
}

// Checkout handles the checkout process
func (h *OrderHandler) Checkout(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	var req models.CheckoutRequest
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

	order, err := h.orderService.Checkout(c.Request.Context(), userID.(string), &req)
	if err != nil {
		if errors.Is(err, services.ErrEmptyCart) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "cart is empty",
				"code":  "EMPTY_CART",
			})
			return
		}
		if errors.Is(err, services.ErrPaymentFailed) {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error": "payment failed",
				"code":  "PAYMENT_FAILED",
			})
			return
		}

		log.Error().Err(err).Str("user_id", userID.(string)).Msg("checkout failed")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to process checkout",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": order})
}

// CreatePaymentIntent creates a Stripe PaymentIntent for the current cart
func (h *OrderHandler) CreatePaymentIntent(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "code": "UNAUTHORIZED"})
		return
	}

	clientSecret, piID, total, err := h.orderService.CreatePaymentIntent(c.Request.Context(), userID.(string))
	if err != nil {
		if errors.Is(err, services.ErrEmptyCart) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cart is empty", "code": "EMPTY_CART"})
			return
		}
		log.Error().Err(err).Str("user_id", userID.(string)).Msg("failed to create payment intent")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create payment intent", "code": "INTERNAL_ERROR"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": models.PaymentIntentResponse{
		ClientSecret:    clientSecret,
		PaymentIntentID: piID,
		TotalAmount:     total,
	}})
}

// ConfirmCheckout verifies the Stripe PaymentIntent and finalises the order
func (h *OrderHandler) ConfirmCheckout(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "code": "UNAUTHORIZED"})
		return
	}

	var req models.ConfirmCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "code": "VALIDATION_ERROR"})
		return
	}

	order, err := h.orderService.ConfirmCheckout(c.Request.Context(), userID.(string), req.PaymentIntentID, req.ShippingAddress)
	if err != nil {
		if errors.Is(err, services.ErrEmptyCart) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cart is empty", "code": "EMPTY_CART"})
			return
		}
		if errors.Is(err, services.ErrPaymentFailed) {
			c.JSON(http.StatusPaymentRequired, gin.H{"error": "payment verification failed", "code": "PAYMENT_FAILED"})
			return
		}
		log.Error().Err(err).Str("user_id", userID.(string)).Msg("confirm checkout failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to confirm checkout", "code": "INTERNAL_ERROR"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": order})
}

// SimulatePayment handles payment simulation requests (for testing)
func (h *OrderHandler) SimulatePayment(c *gin.Context) {
	// Check for simulate_failure query param
	shouldFail := c.Query("fail") == "true"

	// Default amount for simulation
	amount := 100.00
	if amtStr := c.Query("amount"); amtStr != "" {
		if amt, err := strconv.ParseFloat(amtStr, 64); err == nil {
			amount = amt
		}
	}

	result := h.orderService.SimulatePayment(c.Request.Context(), amount, shouldFail)
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// GetUserOrders handles retrieving a user's order history
func (h *OrderHandler) GetUserOrders(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	// Parse pagination params
	page := 1
	perPage := 10

	if pageStr := c.Query("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}
	if perPageStr := c.Query("per_page"); perPageStr != "" {
		if pp, err := strconv.Atoi(perPageStr); err == nil && pp > 0 && pp <= 100 {
			perPage = pp
		}
	}

	response, err := h.orderService.GetUserOrders(c.Request.Context(), userID.(string), page, perPage)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID.(string)).Msg("failed to get user orders")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get orders",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetOrderByID handles retrieving a specific order
func (h *OrderHandler) GetOrderByID(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	orderID := c.Param("id")
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "order id is required",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	userIDStr := userID.(string)
	order, err := h.orderService.GetOrderByID(c.Request.Context(), orderID, &userIDStr)
	if err != nil {
		if errors.Is(err, services.ErrOrderNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "order not found",
				"code":  "NOT_FOUND",
			})
			return
		}

		log.Error().Err(err).Str("order_id", orderID).Str("user_id", userIDStr).Msg("failed to get order")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get order",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": order})
}

// RequestCancellation handles order cancellation requests
func (h *OrderHandler) RequestCancellation(c *gin.Context) {
	userID, exists := c.Get(auth.ContextKeyUserID)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	orderID := c.Param("id")
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "order id is required",
			"code":  "VALIDATION_ERROR",
		})
		return
	}

	var req models.CancellationRequest
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

	if err := h.orderService.RequestCancellation(c.Request.Context(), orderID, userID.(string), req.Reason); err != nil {
		switch {
		case errors.Is(err, services.ErrOrderNotFound):
			c.JSON(http.StatusNotFound, gin.H{
				"error": "order not found",
				"code":  "NOT_FOUND",
			})
		case errors.Is(err, services.ErrCancellationNotAllowed):
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "cancellation not allowed for this order status",
				"code":  "CANCELLATION_NOT_ALLOWED",
			})
		case errors.Is(err, services.ErrCancellationAlreadyRequested):
			c.JSON(http.StatusConflict, gin.H{
				"error": "cancellation already requested",
				"code":  "ALREADY_REQUESTED",
			})
		default:
			log.Error().Err(err).Str("order_id", orderID).Str("user_id", userID.(string)).Msg("cancellation request failed")
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to request cancellation",
				"code":  "INTERNAL_ERROR",
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "cancellation request submitted successfully",
	})
}
