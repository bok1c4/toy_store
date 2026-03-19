package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

// extractFieldErrors converts validator.ValidationErrors into a map of field → message.
func extractFieldErrors(err error) map[string]string {
	fields := make(map[string]string)
	var validationErrors validator.ValidationErrors
	if errors.As(err, &validationErrors) {
		for _, e := range validationErrors {
			fields[strings.ToLower(e.Field())] = e.Tag()
		}
	}
	return fields
}

// respondError writes a standard JSON error response.
func respondError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"error": message,
		"code":  code,
	})
}

// respondValidationError writes a 400 response with per-field validation details.
func respondValidationError(c *gin.Context, err error) {
	c.JSON(http.StatusBadRequest, gin.H{
		"error":        "validation failed",
		"code":         "VALIDATION_ERROR",
		"field_errors": extractFieldErrors(err),
	})
}

// getValidationTagMessage returns a human-readable message for a validation tag.
func getValidationTagMessage(e validator.FieldError) string {
	switch e.Tag() {
	case "required":
		return "this field is required"
	case "email":
		return "invalid email format"
	case "min":
		return "value is too short"
	case "max":
		return "value is too long"
	default:
		return e.Tag()
	}
}
