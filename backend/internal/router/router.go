package router

import (
	"net/http"
	"time"

	"github.com/bok1c4/toy_store/backend/config"
	"github.com/bok1c4/toy_store/backend/internal/auth"
	"github.com/bok1c4/toy_store/backend/internal/cache"
	"github.com/bok1c4/toy_store/backend/internal/handlers"
	"github.com/bok1c4/toy_store/backend/internal/repository"
	"github.com/bok1c4/toy_store/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
	"github.com/ulule/limiter/v3"
	mgin "github.com/ulule/limiter/v3/drivers/middleware/gin"
	"github.com/ulule/limiter/v3/drivers/store/memory"
)

var (
	cfg         *config.Config
	dbPool      interface{}
	redisClient interface{}
)

func Init(cfgParam *config.Config, db interface{}, redis interface{}) {
	cfg = cfgParam
	dbPool = db
	redisClient = redis
}

func New() *gin.Engine {
	r := gin.New()

	r.Use(gin.Recovery())
	r.Use(requestLogger())
	r.Use(corsMiddleware())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	db := dbPool.(*pgxpool.Pool)
	redis := redisClient.(*cache.Client).Rdb()
	jwtManager := auth.NewJWTManager(cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)
	authMiddleware := auth.NewMiddleware(jwtManager)

	userRepo := repository.NewUserRepository(db)
	authService := services.NewAuthService(userRepo, jwtManager, redis)

	authHandler := handlers.NewAuthHandler(authService)
	userHandler := handlers.NewUserHandler(authService)

	toyService := services.NewToyService(redis, cfg.ExternalAPIURL)
	toyHandler := handlers.NewToyHandler(toyService)

	rate := limiter.Rate{
		Period: 1 * time.Minute,
		Limit:  10,
	}
	store := memory.NewStore()
	instance := limiter.New(store, rate)

	authGroup := r.Group("/api/auth")
	authGroup.POST("/register", mgin.NewMiddleware(instance), authHandler.Register)
	authGroup.POST("/login", mgin.NewMiddleware(instance), authHandler.Login)
	authGroup.POST("/refresh", authHandler.Refresh)
	authGroup.POST("/logout", authHandler.Logout)

	toyGroup := r.Group("/api/toys")
	{
		toyGroup.GET("", toyHandler.GetToys)
		toyGroup.GET("/:id", toyHandler.GetToyByID)
		toyGroup.GET("/permalink/:slug", toyHandler.GetToyByPermalink)
		toyGroup.GET("/age-groups", toyHandler.GetAgeGroups)
		toyGroup.GET("/types", toyHandler.GetTypes)
	}

	userGroup := r.Group("/api/user")
	userGroup.Use(authMiddleware.RequireAuth())
	{
		userGroup.GET("/profile", userHandler.GetProfile)
		userGroup.PUT("/profile", userHandler.UpdateProfile)
		userGroup.PUT("/password", userHandler.ChangePassword)
	}

	cartRepo := repository.NewCartRepository(db)
	cartService := services.NewCartService(cartRepo, toyService)
	cartHandler := handlers.NewCartHandler(cartService)

	cartGroup := r.Group("/api/cart")
	cartGroup.Use(authMiddleware.RequireAuth())
	{
		cartGroup.GET("", cartHandler.GetCart)
		cartGroup.POST("", cartHandler.AddToCart)
		cartGroup.PUT("/:item_id", cartHandler.UpdateCartItem)
		cartGroup.DELETE("/:item_id", cartHandler.RemoveFromCart)
		cartGroup.DELETE("", cartHandler.ClearCart)
	}

	wishlistRepo := repository.NewWishlistRepository(db)
	wishlistService := services.NewWishlistService(wishlistRepo, toyService)
	wishlistHandler := handlers.NewWishlistHandler(wishlistService)

	wishlistGroup := r.Group("/api/wishlist")
	wishlistGroup.Use(authMiddleware.RequireAuth())
	{
		wishlistGroup.GET("", wishlistHandler.GetWishlist)
		wishlistGroup.POST("", wishlistHandler.AddToWishlist)
		wishlistGroup.DELETE("/:toy_id", wishlistHandler.RemoveFromWishlist)
		wishlistGroup.GET("/check/:toy_id", wishlistHandler.CheckWishlist)
	}

	// Order and Checkout routes
	orderRepo := repository.NewOrderRepository(db)
	paymentService := services.NewPaymentService(cfg.StripeSecretKey, cfg.StripeWebhookSecret)
	orderService := services.NewOrderService(orderRepo, cartRepo, userRepo, paymentService)
	orderHandler := handlers.NewOrderHandler(orderService)
	webhookHandler := handlers.NewWebhookHandler(paymentService)

	checkoutGroup := r.Group("/api/checkout")
	checkoutGroup.Use(authMiddleware.RequireAuth())
	{
		checkoutGroup.POST("", orderHandler.Checkout)
		checkoutGroup.POST("/intent", orderHandler.CreatePaymentIntent)
		checkoutGroup.POST("/confirm", orderHandler.ConfirmCheckout)
		checkoutGroup.GET("/simulate", orderHandler.SimulatePayment)
	}

	// Webhook endpoint (no auth required - Stripe calls this directly)
	r.POST("/api/webhook/stripe", webhookHandler.HandleStripeWebhook)

	// User order routes
	userGroup.GET("/orders", orderHandler.GetUserOrders)
	userGroup.GET("/orders/:id", orderHandler.GetOrderByID)
	userGroup.POST("/orders/:id/cancel", orderHandler.RequestCancellation)

	// Admin routes
	adminService := services.NewAdminService(db, userRepo)
	adminHandler := handlers.NewAdminHandler(orderRepo, userRepo, adminService)
	adminGroup := r.Group("/api/admin")
	adminGroup.Use(authMiddleware.RequireAuth())
	adminGroup.Use(authMiddleware.RequireAdmin())
	{
		adminGroup.GET("/cancellation-requests", adminHandler.GetCancellationRequests)
		adminGroup.PUT("/cancellation-requests/:id/approve", adminHandler.ApproveCancellation)
		adminGroup.PUT("/cancellation-requests/:id/decline", adminHandler.DeclineCancellation)
		adminGroup.GET("/users", adminHandler.ListUsers)
		adminGroup.GET("/users/:id", adminHandler.GetUser)
		adminGroup.PUT("/users/:id", adminHandler.UpdateUser)
		adminGroup.GET("/orders", adminHandler.ListOrders)
		adminGroup.PUT("/orders/:id", adminHandler.UpdateOrderStatus)
		adminGroup.GET("/analytics", adminHandler.GetAnalytics)
	}

	return r
}

func requestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		clientIP := c.ClientIP()
		method := c.Request.Method
		statusCode := c.Writer.Status()

		if raw != "" {
			path = path + "?" + raw
		}

		event := log.Info().
			Str("client_ip", clientIP).
			Str("method", method).
			Str("path", path).
			Int("status", statusCode).
			Dur("latency", latency)

		userID, exists := c.Get("userID")
		if exists {
			event.Str("user_id", userID.(string))
		}

		if len(c.Errors) > 0 {
			event.Str("error", c.Errors.String())
		}

		event.Msg("http request")
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
