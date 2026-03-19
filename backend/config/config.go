// Package config loads and validates environment variables at startup.
package config

import (
	"fmt"
	"os"
	"time"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	// Database
	DBURL string

	// Redis
	RedisURL string

	// JWT
	JWTSecret     string
	JWTAccessTTL  time.Duration
	JWTRefreshTTL time.Duration

	// External API
	ExternalAPIURL string

	// Stripe
	StripeSecretKey     string
	StripeWebhookSecret string

	// App
	Environment string
	LogLevel    string
}

// Load reads environment variables and returns a validated Config.
func Load() (*Config, error) {
	cfg := &Config{
		DBURL:               getEnv("DB_URL", ""),
		RedisURL:            getEnv("REDIS_URL", ""),
		JWTSecret:           getEnv("JWT_SECRET", ""),
		ExternalAPIURL:      getEnv("EXTERNAL_API_URL", "https://toy.pequla.com/api"),
		StripeSecretKey:     getEnv("STRIPE_SECRET_KEY", ""),
		StripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET", ""),
		Environment:         getEnv("ENVIRONMENT", "development"),
		LogLevel:            getEnv("LOG_LEVEL", "info"),
	}

	// Parse JWT TTLs
	accessTTL := getEnv("JWT_ACCESS_TTL", "15m")
	refreshTTL := getEnv("JWT_REFRESH_TTL", "168h")

	var err error
	cfg.JWTAccessTTL, err = time.ParseDuration(accessTTL)
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_ACCESS_TTL: %w", err)
	}

	cfg.JWTRefreshTTL, err = time.ParseDuration(refreshTTL)
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_REFRESH_TTL: %w", err)
	}

	// Validate required fields
	if cfg.DBURL == "" {
		return nil, fmt.Errorf("DB_URL is required")
	}
	if cfg.RedisURL == "" {
		return nil, fmt.Errorf("REDIS_URL is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

// getEnv retrieves an environment variable or returns a default value.
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// requireEnv returns the value of key or panics if it is unset.
func requireEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("required environment variable %q is not set", key))
	}
	return v
}

// optionalEnv returns the value of key or an empty string if unset.
func optionalEnv(key string) string {
	return os.Getenv(key)
}
