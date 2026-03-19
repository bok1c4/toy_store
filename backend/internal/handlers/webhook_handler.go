package handlers

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/bok1c4/toy_store/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
	"github.com/stripe/stripe-go/v76"
)

// WebhookHandler handles webhook requests.
type WebhookHandler struct {
	paymentService *services.PaymentService
}

// NewWebhookHandler creates a new webhook handler.
func NewWebhookHandler(paymentService *services.PaymentService) *WebhookHandler {
	return &WebhookHandler{paymentService: paymentService}
}

// HandleStripeWebhook handles incoming Stripe webhook events.
func (h *WebhookHandler) HandleStripeWebhook(c *gin.Context) {
	// Must read raw body — cannot use ShouldBind after this
	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Error().Err(err).Msg("failed to read webhook payload")
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read payload"})
		return
	}

	signature := c.GetHeader("Stripe-Signature")
	if signature == "" {
		log.Warn().Msg("missing Stripe-Signature header")
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing Stripe signature"})
		return
	}

	if err := h.paymentService.VerifyWebhook(payload, signature); err != nil {
		log.Error().Err(err).Msg("failed to verify webhook signature")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature"})
		return
	}

	// Parse the event type
	var event stripe.Event
	if err := json.Unmarshal(payload, &event); err != nil {
		log.Error().Err(err).Msg("failed to parse webhook event")
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to parse event"})
		return
	}

	switch event.Type {
	case "payment_intent.succeeded":
		log.Info().Str("event_id", event.ID).Str("type", string(event.Type)).Msg("stripe payment succeeded")
		// Order was already created at checkout time; no action needed here.
	case "payment_intent.payment_failed":
		log.Warn().Str("event_id", event.ID).Str("type", string(event.Type)).Msg("stripe payment failed")
	default:
		log.Info().Str("event_id", event.ID).Str("type", string(event.Type)).Msg("unhandled stripe event type")
	}

	// Always return 200 — Stripe retries on non-200 responses.
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
