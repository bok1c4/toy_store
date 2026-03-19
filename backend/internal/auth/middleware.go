package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	ContextKeyUserID = "userID"
	ContextKeyRole   = "role"
	ContextKeyJTI    = "jti"
)

type Middleware struct {
	jwtManager *JWTManager
}

func NewMiddleware(jwtManager *JWTManager) *Middleware {
	return &Middleware{jwtManager: jwtManager}
}

func (m *Middleware) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "missing authorization header",
				"code":  "UNAUTHORIZED",
			})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "invalid authorization header format",
				"code":  "UNAUTHORIZED",
			})
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims, err := m.jwtManager.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "invalid or expired token",
				"code":  "UNAUTHORIZED",
			})
			c.Abort()
			return
		}

		if claims.Type != "access" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "invalid token type",
				"code":  "UNAUTHORIZED",
			})
			c.Abort()
			return
		}

		c.Set(ContextKeyUserID, claims.UserID)
		c.Set(ContextKeyRole, claims.Role)
		c.Set(ContextKeyJTI, claims.RegisteredClaims.ID)

		c.Next()
	}
}

func (m *Middleware) RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get(ContextKeyRole)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "unauthorized",
				"code":  "UNAUTHORIZED",
			})
			c.Abort()
			return
		}

		if role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "admin access required",
				"code":  "FORBIDDEN",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
