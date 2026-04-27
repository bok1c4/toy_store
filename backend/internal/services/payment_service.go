package services

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/rs/zerolog/log"
	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/paymentintent"
	"github.com/stripe/stripe-go/v76/webhook"
)

// PaymentService handles payment processing
type PaymentService struct {
	stripeSecretKey     string
	stripeWebhookSecret string
	useStripe           bool
}

// NewPaymentService creates a new payment service.
// Stripe mode is enabled when the secret key looks like a real key (starts with "sk_").
func NewPaymentService(stripeSecretKey, stripeWebhookSecret string) *PaymentService {
	useStripe := strings.HasPrefix(stripeSecretKey, "sk_")
	if useStripe {
		log.Info().Msg("Stripe mode enabled — real payments via PaymentIntent flow")
	} else {
		log.Info().Msg("Stripe not configured — mock payment mode active")
	}
	return &PaymentService{
		stripeSecretKey:     stripeSecretKey,
		stripeWebhookSecret: stripeWebhookSecret,
		useStripe:           useStripe,
	}
}

// Simulate is always mock — it is used by POST /api/checkout for test/simulate scenarios.
// Real Stripe payments use CreatePaymentIntent + VerifyPaymentIntent (the two-step flow).
func (s *PaymentService) Simulate(ctx context.Context, amount float64, shouldFail bool) *models.PaymentResult {
	return s.processMockPayment(ctx, amount, shouldFail)
}

// processMockPayment simulates a mock payment
func (s *PaymentService) processMockPayment(ctx context.Context, amount float64, shouldFail bool) *models.PaymentResult {
	// Generate random transaction ID
	transactionID := generateTransactionID()

	// Simulate payment failure if requested (for testing)
	if shouldFail {
		log.Info().
			Str("transaction_id", transactionID).
			Float64("amount", amount).
			Str("status", "failed").
			Msg("mock payment processed (simulated failure)")

		return &models.PaymentResult{
			Success:       false,
			TransactionID: transactionID,
		}
	}

	// Log successful payment
	log.Info().
		Str("transaction_id", transactionID).
		Float64("amount", amount).
		Str("status", "success").
		Msg("mock payment processed")

	return &models.PaymentResult{
		Success:       true,
		TransactionID: transactionID,
	}
}

// CreatePaymentIntent creates a Stripe PaymentIntent and returns (clientSecret, paymentIntentID, error).
// Only valid when Stripe is configured.
func (s *PaymentService) CreatePaymentIntent(ctx context.Context, amount float64) (string, string, error) {
	stripe.Key = s.stripeSecretKey
	// amount is in RSD (whole dinars); Stripe expects the smallest unit (para = 1/100 RSD)
	params := &stripe.PaymentIntentParams{
		Amount:             stripe.Int64(int64(amount * 100)),
		Currency:           stripe.String("rsd"),
		PaymentMethodTypes: []*string{stripe.String("card")},
	}
	pi, err := paymentintent.New(params)
	if err != nil {
		log.Error().Err(err).Float64("amount", amount).Msg("failed to create Stripe payment intent")
		return "", "", fmt.Errorf("failed to create payment intent: %w", err)
	}
	log.Info().Str("payment_intent_id", pi.ID).Float64("amount", amount).Msg("Stripe payment intent created")
	return pi.ClientSecret, pi.ID, nil
}

// VerifyPaymentIntent checks that a Stripe PaymentIntent has status "succeeded".
// Returns true when Stripe is not configured (mock mode).
func (s *PaymentService) VerifyPaymentIntent(piID string) bool {
	if !s.useStripe {
		return true
	}
	stripe.Key = s.stripeSecretKey
	pi, err := paymentintent.Get(piID, nil)
	if err != nil {
		log.Error().Err(err).Str("payment_intent_id", piID).Msg("failed to retrieve payment intent")
		return false
	}
	return pi.Status == stripe.PaymentIntentStatusSucceeded
}

// VerifyWebhook verifies a Stripe webhook signature.
// Skipped when Stripe is not configured or when webhook secret is not set.
func (s *PaymentService) VerifyWebhook(payload []byte, signature string) error {
	if !s.useStripe || s.stripeWebhookSecret == "" {
		return nil
	}

	_, err := webhook.ConstructEvent(payload, signature, s.stripeWebhookSecret)
	if err != nil {
		log.Error().Err(err).Msg("failed to verify Stripe webhook signature")
		return err
	}

	return nil
}

// generateTransactionID creates a random transaction ID
func generateTransactionID() string {
	rand.Seed(time.Now().UnixNano())
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	result := make([]byte, 6)
	for i := range result {
		result[i] = chars[rand.Intn(len(chars))]
	}
	return fmt.Sprintf("FAKE-TXN-%s", string(result))
}
