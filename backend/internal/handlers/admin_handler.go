package handlers

import (
	"net/http"
	"strconv"

	"github.com/bok1c4/toy_store/backend/internal/auth"
	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/bok1c4/toy_store/backend/internal/repository"
	"github.com/bok1c4/toy_store/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// AdminHandler handles admin-specific HTTP requests.
type AdminHandler struct {
	orderRepo    *repository.OrderRepository
	userRepo     *repository.UserRepository
	adminService *services.AdminService
}

// NewAdminHandler creates a new admin handler.
func NewAdminHandler(
	orderRepo *repository.OrderRepository,
	userRepo *repository.UserRepository,
	adminService *services.AdminService,
) *AdminHandler {
	return &AdminHandler{
		orderRepo:    orderRepo,
		userRepo:     userRepo,
		adminService: adminService,
	}
}

// parsePagination extracts page/per_page query params with sensible defaults.
func parsePagination(c *gin.Context, defaultPerPage int) (int, int) {
	page, perPage := 1, defaultPerPage
	if p, err := strconv.Atoi(c.Query("page")); err == nil && p > 0 {
		page = p
	}
	if pp, err := strconv.Atoi(c.Query("per_page")); err == nil && pp > 0 && pp <= 100 {
		perPage = pp
	}
	return page, perPage
}

// GetCancellationRequests returns pending cancellation requests for admin review.
func (h *AdminHandler) GetCancellationRequests(c *gin.Context) {
	page, perPage := parsePagination(c, 20)

	requests, total, err := h.orderRepo.GetCancellationRequests(c.Request.Context(), page, perPage)
	if err != nil {
		log.Error().Err(err).Msg("failed to get cancellation requests")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get cancellation requests",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, models.CancellationListResponse{
		Data:    requests,
		Total:   total,
		Page:    page,
		PerPage: perPage,
	})
}

// ApproveCancellation approves a cancellation request.
func (h *AdminHandler) ApproveCancellation(c *gin.Context) {
	orderID := c.Param("id")
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order id is required", "code": "VALIDATION_ERROR"})
		return
	}

	var req models.CancellationResponse
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "validation failed",
			"code":   "VALIDATION_ERROR",
			"fields": extractFieldErrors(err),
		})
		return
	}

	if err := h.orderRepo.RespondToCancellation(c.Request.Context(), orderID, true, req.Response); err != nil {
		log.Error().Err(err).Str("order_id", orderID).Msg("failed to approve cancellation")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to approve cancellation",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "cancellation approved"})
}

// DeclineCancellation declines a cancellation request.
func (h *AdminHandler) DeclineCancellation(c *gin.Context) {
	orderID := c.Param("id")
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order id is required", "code": "VALIDATION_ERROR"})
		return
	}

	var req models.CancellationResponse
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "validation failed",
			"code":   "VALIDATION_ERROR",
			"fields": extractFieldErrors(err),
		})
		return
	}

	if err := h.orderRepo.RespondToCancellation(c.Request.Context(), orderID, false, req.Response); err != nil {
		log.Error().Err(err).Str("order_id", orderID).Msg("failed to decline cancellation")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to decline cancellation",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "cancellation declined"})
}

// UpdateOrderStatus allows admin to update order status.
func (h *AdminHandler) UpdateOrderStatus(c *gin.Context) {
	orderID := c.Param("id")
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order id is required", "code": "VALIDATION_ERROR"})
		return
	}

	var req struct {
		Status models.OrderStatus `json:"status" validate:"required,oneof=pending processing shipped delivered cancelled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "validation failed",
			"code":   "VALIDATION_ERROR",
			"fields": extractFieldErrors(err),
		})
		return
	}

	adminID, _ := c.Get(auth.ContextKeyUserID)
	if err := h.orderRepo.UpdateStatus(c.Request.Context(), orderID, req.Status); err != nil {
		log.Error().Err(err).Str("order_id", orderID).Interface("admin_id", adminID).Msg("failed to update order status")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to update order status",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "order status updated"})
}

// ListUsers returns a paginated list of all users.
func (h *AdminHandler) ListUsers(c *gin.Context) {
	adminID, _ := c.Get(auth.ContextKeyUserID)
	page, perPage := parsePagination(c, 20)

	users, total, err := h.userRepo.ListAll(c.Request.Context(), page, perPage)
	if err != nil {
		log.Error().Err(err).Interface("admin_id", adminID).Msg("failed to list users")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to list users",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, models.AdminUserListResponse{
		Data:    users,
		Total:   total,
		Page:    page,
		PerPage: perPage,
	})
}

// GetUser returns a single user with their order count.
func (h *AdminHandler) GetUser(c *gin.Context) {
	adminID, _ := c.Get(auth.ContextKeyUserID)
	userID := c.Param("id")

	result, err := h.adminService.GetUserWithOrderCount(c.Request.Context(), userID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Interface("admin_id", adminID).Msg("failed to get user")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get user",
			"code":  "INTERNAL_ERROR",
		})
		return
	}
	if result == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found", "code": "NOT_FOUND"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// UpdateUser updates a user's is_active flag or role.
func (h *AdminHandler) UpdateUser(c *gin.Context) {
	adminID, _ := c.Get(auth.ContextKeyUserID)
	userID := c.Param("id")

	var req models.AdminUpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "validation failed",
			"code":   "VALIDATION_ERROR",
			"fields": extractFieldErrors(err),
		})
		return
	}

	var role *models.UserRole
	if req.Role != nil {
		r := models.UserRole(*req.Role)
		role = &r
	}

	user, err := h.userRepo.UpdateAdmin(c.Request.Context(), userID, req.IsActive, role)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Interface("admin_id", adminID).Msg("failed to update user")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to update user",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": user})
}

// ListOrders returns a paginated list of all orders, optionally filtered by status.
func (h *AdminHandler) ListOrders(c *gin.Context) {
	adminID, _ := c.Get(auth.ContextKeyUserID)
	page, perPage := parsePagination(c, 20)
	status := c.Query("status")

	orders, total, err := h.orderRepo.ListAll(c.Request.Context(), status, page, perPage)
	if err != nil {
		log.Error().Err(err).Interface("admin_id", adminID).Msg("failed to list orders")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to list orders",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, models.AdminOrderListResponse{
		Data:    orders,
		Total:   total,
		Page:    page,
		PerPage: perPage,
	})
}

// GetAnalytics returns store-wide analytics for the admin dashboard.
func (h *AdminHandler) GetAnalytics(c *gin.Context) {
	adminID, _ := c.Get(auth.ContextKeyUserID)

	analytics, err := h.adminService.GetAnalytics(c.Request.Context())
	if err != nil {
		log.Error().Err(err).Interface("admin_id", adminID).Msg("failed to get analytics")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get analytics",
			"code":  "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": analytics})
}
