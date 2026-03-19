package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"

	"github.com/bok1c4/toy_store/backend/internal/models"
)

const (
	cacheKeyAllToys        = "toys:all"
	cacheKeyToyByID        = "toy:%d"
	cacheKeyToyByPermalink = "toy:permalink:%s"
	cacheKeyAgeGroups      = "age-groups"
	cacheKeyToyTypes       = "toy-types"

	cacheTTL         = 5 * time.Minute
	cacheTTLMetadata = 30 * time.Minute
)

type ToyService struct {
	httpClient   *http.Client
	redis        *redis.Client
	externalAPI  string
	imageBaseURL string
}

func NewToyService(redisClient *redis.Client, externalAPI string) *ToyService {
	// Remove /api suffix for image base URL
	imageBaseURL := strings.TrimSuffix(externalAPI, "/api")

	return &ToyService{
		httpClient:   &http.Client{Timeout: 10 * time.Second},
		redis:        redisClient,
		externalAPI:  externalAPI,
		imageBaseURL: imageBaseURL,
	}
}

func (s *ToyService) GetAll(ctx context.Context) ([]models.Toy, error) {
	return s.getAllWithFilters(ctx, "", "", "")
}

func (s *ToyService) GetAllFiltered(ctx context.Context, ageGroup, toyType, query string) ([]models.Toy, error) {
	return s.getAllWithFilters(ctx, ageGroup, toyType, query)
}

func (s *ToyService) getAllWithFilters(ctx context.Context, ageGroup, toyType, query string) ([]models.Toy, error) {
	// Build cache key based on filters
	cacheKey := cacheKeyAllToys
	if ageGroup != "" || toyType != "" || query != "" {
		cacheKey = fmt.Sprintf("toys:filtered:%s:%s:%s", ageGroup, toyType, query)
	}

	cached, err := s.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		log.Debug().Str("key", cacheKey).Msg("cache_hit")
		var toys []models.Toy
		if err := json.Unmarshal([]byte(cached), &toys); err != nil {
			return nil, fmt.Errorf("failed to unmarshal cached toys: %w", err)
		}
		return toys, nil
	}

	log.Debug().Str("key", cacheKey).Msg("cache_miss")

	// Get all toys from cache or API
	allToys, err := s.getAllToys(ctx)
	if err != nil {
		return nil, err
	}

	// Apply filters
	toys := FilterToys(allToys, ageGroup, toyType, query)

	// Cache filtered results
	data, err := json.Marshal(toys)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal toys: %w", err)
	}

	if err := s.redis.Set(ctx, cacheKey, data, cacheTTL).Err(); err != nil {
		log.Warn().Err(err).Str("key", cacheKey).Msg("failed to cache toys")
	}

	return toys, nil
}

func (s *ToyService) getAllToys(ctx context.Context) ([]models.Toy, error) {
	cached, err := s.redis.Get(ctx, cacheKeyAllToys).Result()
	if err == nil {
		var toys []models.Toy
		if err := json.Unmarshal([]byte(cached), &toys); err != nil {
			return nil, fmt.Errorf("failed to unmarshal cached toys: %w", err)
		}
		return toys, nil
	}

	toys, err := s.fetchToysFromAPI(ctx, "")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch toys from API: %w", err)
	}

	data, err := json.Marshal(toys)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal toys: %w", err)
	}

	if err := s.redis.Set(ctx, cacheKeyAllToys, data, cacheTTL).Err(); err != nil {
		log.Warn().Err(err).Str("key", cacheKeyAllToys).Msg("failed to cache toys")
	}

	return toys, nil
}

func (s *ToyService) GetByID(ctx context.Context, id int) (*models.Toy, error) {
	cacheKey := fmt.Sprintf(cacheKeyToyByID, id)

	cached, err := s.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		log.Debug().Str("key", cacheKey).Msg("cache_hit")
		var toy models.Toy
		if err := json.Unmarshal([]byte(cached), &toy); err != nil {
			return nil, fmt.Errorf("failed to unmarshal cached toy: %w", err)
		}
		return &toy, nil
	}

	log.Debug().Str("key", cacheKey).Msg("cache_miss")

	toy, err := s.fetchToyByIDFromAPI(ctx, id)
	if err != nil {
		return nil, err
	}

	data, err := json.Marshal(toy)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal toy: %w", err)
	}

	if err := s.redis.Set(ctx, cacheKey, data, cacheTTL).Err(); err != nil {
		log.Warn().Err(err).Str("key", cacheKey).Msg("failed to cache toy")
	}

	return toy, nil
}

func (s *ToyService) GetByPermalink(ctx context.Context, slug string) (*models.Toy, error) {
	cacheKey := fmt.Sprintf(cacheKeyToyByPermalink, slug)

	cached, err := s.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		log.Debug().Str("key", cacheKey).Msg("cache_hit")
		var toy models.Toy
		if err := json.Unmarshal([]byte(cached), &toy); err != nil {
			return nil, fmt.Errorf("failed to unmarshal cached toy: %w", err)
		}
		return &toy, nil
	}

	log.Debug().Str("key", cacheKey).Msg("cache_miss")

	toy, err := s.fetchToyByPermalinkFromAPI(ctx, slug)
	if err != nil {
		return nil, err
	}

	data, err := json.Marshal(toy)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal toy: %w", err)
	}

	if err := s.redis.Set(ctx, cacheKey, data, cacheTTL).Err(); err != nil {
		log.Warn().Err(err).Str("key", cacheKey).Msg("failed to cache toy")
	}

	if toy != nil {
		idKey := fmt.Sprintf(cacheKeyToyByID, toy.ID)
		if err := s.redis.Set(ctx, idKey, data, cacheTTL).Err(); err != nil {
			log.Warn().Err(err).Str("key", idKey).Msg("failed to cache toy by ID")
		}
	}

	return toy, nil
}

func (s *ToyService) GetAgeGroups(ctx context.Context) ([]models.AgeGroup, error) {
	cacheKey := cacheKeyAgeGroups

	cached, err := s.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		log.Debug().Str("key", cacheKey).Msg("cache_hit")
		var ageGroups []models.AgeGroup
		if err := json.Unmarshal([]byte(cached), &ageGroups); err != nil {
			return nil, fmt.Errorf("failed to unmarshal cached age groups: %w", err)
		}
		return ageGroups, nil
	}

	log.Debug().Str("key", cacheKey).Msg("cache_miss")

	ageGroups, err := s.fetchAgeGroupsFromAPI(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch age groups from API: %w", err)
	}

	data, err := json.Marshal(ageGroups)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal age groups: %w", err)
	}

	if err := s.redis.Set(ctx, cacheKey, data, cacheTTLMetadata).Err(); err != nil {
		log.Warn().Err(err).Str("key", cacheKey).Msg("failed to cache age groups")
	}

	return ageGroups, nil
}

func (s *ToyService) GetTypes(ctx context.Context) ([]models.ToyType, error) {
	cacheKey := cacheKeyToyTypes

	cached, err := s.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		log.Debug().Str("key", cacheKey).Msg("cache_hit")
		var toyTypes []models.ToyType
		if err := json.Unmarshal([]byte(cached), &toyTypes); err != nil {
			return nil, fmt.Errorf("failed to unmarshal cached toy types: %w", err)
		}
		return toyTypes, nil
	}

	log.Debug().Str("key", cacheKey).Msg("cache_miss")

	toyTypes, err := s.fetchTypesFromAPI(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch toy types from API: %w", err)
	}

	data, err := json.Marshal(toyTypes)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal toy types: %w", err)
	}

	if err := s.redis.Set(ctx, cacheKey, data, cacheTTLMetadata).Err(); err != nil {
		log.Warn().Err(err).Str("key", cacheKey).Msg("failed to cache toy types")
	}

	return toyTypes, nil
}

func FilterToys(toys []models.Toy, ageGroup, toyType, query string) []models.Toy {
	// Ensure we never return nil
	if toys == nil {
		toys = []models.Toy{}
	}

	result := toys

	if ageGroup != "" {
		filtered := make([]models.Toy, 0)
		for _, t := range result {
			if t.AgeGroup == ageGroup {
				filtered = append(filtered, t)
			}
		}
		result = filtered
	}

	if toyType != "" {
		filtered := make([]models.Toy, 0)
		for _, t := range result {
			if t.Type == toyType {
				filtered = append(filtered, t)
			}
		}
		result = filtered
	}

	if query != "" {
		lowerQuery := strings.ToLower(query)
		filtered := make([]models.Toy, 0)
		for _, t := range result {
			if strings.Contains(strings.ToLower(t.Name), lowerQuery) ||
				strings.Contains(strings.ToLower(t.Description), lowerQuery) {
				filtered = append(filtered, t)
			}
		}
		result = filtered
	}

	return result
}

func (s *ToyService) fetchToysFromAPI(ctx context.Context, query string) ([]models.Toy, error) {
	url := s.externalAPI + "/toy"
	if query != "" {
		url += "?q=" + query
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch toys: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("external API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var externalToys []models.ToyExternal
	if err := json.Unmarshal(body, &externalToys); err != nil {
		return nil, fmt.Errorf("failed to unmarshal toys response: %w", err)
	}

	toys := make([]models.Toy, len(externalToys))
	for i, et := range externalToys {
		toy := et.ToToy()
		// Prepend external API base URL to relative image paths
		if toy.Image != "" && toy.Image[0] == '/' {
			toy.Image = s.imageBaseURL + toy.Image
		}
		toys[i] = toy
	}

	return toys, nil
}

func (s *ToyService) fetchToyByIDFromAPI(ctx context.Context, id int) (*models.Toy, error) {
	url := fmt.Sprintf("%s/toy/%d", s.externalAPI, id)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch toy: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("toy not found")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("external API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var externalToy models.ToyExternal
	if err := json.Unmarshal(body, &externalToy); err != nil {
		return nil, fmt.Errorf("failed to unmarshal toy response: %w", err)
	}

	toy := externalToy.ToToy()
	// Prepend external API base URL to relative image paths
	if toy.Image != "" && toy.Image[0] == '/' {
		toy.Image = s.imageBaseURL + toy.Image
	}
	return &toy, nil
}

func (s *ToyService) fetchToyByPermalinkFromAPI(ctx context.Context, slug string) (*models.Toy, error) {
	url := fmt.Sprintf("%s/toy/permalink/%s", s.externalAPI, slug)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch toy: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("toy not found")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("external API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var externalToy models.ToyExternal
	if err := json.Unmarshal(body, &externalToy); err != nil {
		return nil, fmt.Errorf("failed to unmarshal toy response: %w", err)
	}

	toy := externalToy.ToToy()
	// Prepend external API base URL to relative image paths
	if toy.Image != "" && toy.Image[0] == '/' {
		toy.Image = s.imageBaseURL + toy.Image
	}
	return &toy, nil
}

func (s *ToyService) fetchAgeGroupsFromAPI(ctx context.Context) ([]models.AgeGroup, error) {
	url := s.externalAPI + "/age-group"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch age groups: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("external API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var ageGroups []models.AgeGroup
	if err := json.Unmarshal(body, &ageGroups); err != nil {
		return nil, fmt.Errorf("failed to unmarshal age groups response: %w", err)
	}

	return ageGroups, nil
}

func (s *ToyService) fetchTypesFromAPI(ctx context.Context) ([]models.ToyType, error) {
	url := s.externalAPI + "/type"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch toy types: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("external API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var toyTypes []models.ToyType
	if err := json.Unmarshal(body, &toyTypes); err != nil {
		return nil, fmt.Errorf("failed to unmarshal toy types response: %w", err)
	}

	return toyTypes, nil
}
