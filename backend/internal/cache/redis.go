// Package cache provides Redis client and cache operations.
package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// Client wraps redis.Client with helper methods.
type Client struct {
	rdb *redis.Client
}

// NewRedisClient creates a new Redis client from a URL string.
func NewRedisClient(redisURL string) (*Client, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	rdb := redis.NewClient(opt)

	return &Client{rdb: rdb}, nil
}

// Ping verifies the Redis connection.
func (c *Client) Ping(ctx context.Context) error {
	if err := c.rdb.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to ping Redis: %w", err)
	}
	log.Info().Msg("Connected to Redis")
	return nil
}

// Close closes the Redis client.
func (c *Client) Close() error {
	if c.rdb != nil {
		if err := c.rdb.Close(); err != nil {
			return fmt.Errorf("failed to close Redis client: %w", err)
		}
		log.Info().Msg("Redis client closed")
	}
	return nil
}

// Get retrieves a value from Redis.
func (c *Client) Get(ctx context.Context, key string) (string, error) {
	return c.rdb.Get(ctx, key).Result()
}

// Set stores a value in Redis with an expiration time.
func (c *Client) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return c.rdb.Set(ctx, key, value, expiration).Err()
}

// Delete removes a key from Redis.
func (c *Client) Delete(ctx context.Context, key string) error {
	return c.rdb.Del(ctx, key).Err()
}

// Rdb returns the underlying redis.Client for direct access.
func (c *Client) Rdb() *redis.Client {
	return c.rdb
}
