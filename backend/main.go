// Package main is the entry point for the toy store backend application.
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/bok1c4/toy_store/backend/config"
	"github.com/bok1c4/toy_store/backend/internal/cache"
	"github.com/bok1c4/toy_store/backend/internal/database"
	"github.com/bok1c4/toy_store/backend/internal/router"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Setup logging
	setupLogging(cfg.LogLevel)
	log.Info().Msg("Starting Toy Store API")

	// Create context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Setup signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Initialize database
	dbPool, err := database.NewPostgresPool(ctx, cfg.DBURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer database.Close(dbPool)

	// Run migrations
	if err := runMigrations(cfg.DBURL); err != nil {
		log.Fatal().Err(err).Msg("Failed to run migrations")
	}
	log.Info().Msg("Database migrations completed")

	// Initialize Redis
	redisClient, err := cache.NewRedisClient(cfg.RedisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to Redis")
	}
	defer redisClient.Close()

	if err := redisClient.Ping(ctx); err != nil {
		log.Fatal().Err(err).Msg("Failed to ping Redis")
	}

	// Initialize router
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router.Init(cfg, dbPool, redisClient)
	r := router.New()

	// Create HTTP server
	srv := &http.Server{
		Addr:    ":8080",
		Handler: r,
	}

	// Start server in goroutine
	go func() {
		log.Info().Str("addr", srv.Addr).Msg("Server starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed to start")
		}
	}()

	// Wait for shutdown signal
	<-sigChan
	log.Info().Msg("Shutting down server...")

	// Graceful shutdown with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("Server forced to shutdown")
	}

	log.Info().Msg("Server exited")
}

// setupLogging configures zerolog based on environment.
func setupLogging(level string) {
	// Set output to console for development
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix

	switch level {
	case "debug":
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	case "info":
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	case "warn":
		zerolog.SetGlobalLevel(zerolog.WarnLevel)
	case "error":
		zerolog.SetGlobalLevel(zerolog.ErrorLevel)
	default:
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}

	// Use console writer for development
	if os.Getenv("ENVIRONMENT") != "production" {
		log.Logger = zerolog.New(zerolog.ConsoleWriter{Out: os.Stderr}).With().Timestamp().Logger()
	}
}

// runMigrations runs database migrations using golang-migrate.
func runMigrations(databaseURL string) error {
	// Convert postgres:// URL to the format golang-migrate expects
	// It needs database/postgres driver URL
	m, err := migrate.New(
		"file://migrations",
		databaseURL,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrate instance: %w", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	return nil
}
