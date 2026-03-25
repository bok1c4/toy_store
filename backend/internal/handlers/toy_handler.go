package handlers

import (
	"net/http"
	"strconv"

	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/bok1c4/toy_store/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

type ToyHandler struct {
	toyService *services.ToyService
}

func NewToyHandler(toyService *services.ToyService) *ToyHandler {
	return &ToyHandler{toyService: toyService}
}

func (h *ToyHandler) GetToys(c *gin.Context) {
	ageGroup := c.Query("age_group")
	toyType := c.Query("type")
	query := c.Query("q")
	pageStr := c.DefaultQuery("page", "1")
	perPageStr := c.DefaultQuery("per_page", "20")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	perPage, err := strconv.Atoi(perPageStr)
	if err != nil || perPage < 1 {
		perPage = 20
	}

	filteredToys, err := h.toyService.GetAllFiltered(c.Request.Context(), ageGroup, toyType, query)
	if err != nil {
		log.Error().Err(err).Msg("failed to get toys")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "unable to load toys. please try again later.",
			"code":  "TOY_SERVICE_UNAVAILABLE",
		})
		return
	}

	total := len(filteredToys)

	// Ensure filteredToys is never nil (avoid null in JSON)
	if filteredToys == nil {
		filteredToys = []models.Toy{}
	}

	start := (page - 1) * perPage
	end := start + perPage
	if start > len(filteredToys) {
		filteredToys = []models.Toy{}
	} else {
		if end > len(filteredToys) {
			end = len(filteredToys)
		}
		filteredToys = filteredToys[start:end]
	}

	c.JSON(http.StatusOK, gin.H{
		"data":     filteredToys,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

func (h *ToyHandler) GetToyByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid toy id",
			"code":  "INVALID_ID",
		})
		return
	}

	toy, err := h.toyService.GetByID(c.Request.Context(), id)
	if err != nil {
		log.Error().Err(err).Int("toy_id", id).Msg("failed to get toy by id")
		c.JSON(http.StatusNotFound, gin.H{
			"error": "toy not found",
			"code":  "TOY_NOT_FOUND",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": toy,
	})
}

func (h *ToyHandler) GetToyByPermalink(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid permalink",
			"code":  "INVALID_PERMALINK",
		})
		return
	}

	toy, err := h.toyService.GetByPermalink(c.Request.Context(), slug)
	if err != nil {
		log.Error().Err(err).Str("slug", slug).Msg("failed to get toy by permalink")
		c.JSON(http.StatusNotFound, gin.H{
			"error": "toy not found",
			"code":  "TOY_NOT_FOUND",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": toy,
	})
}

func (h *ToyHandler) GetAgeGroups(c *gin.Context) {
	ageGroups, err := h.toyService.GetAgeGroups(c.Request.Context())
	if err != nil {
		log.Error().Err(err).Msg("failed to get age groups")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "unable to load age groups. please try again later.",
			"code":  "TOY_SERVICE_UNAVAILABLE",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": ageGroups,
	})
}

func (h *ToyHandler) SearchSuggestions(c *gin.Context) {
	query := c.Query("q")
	limitStr := c.DefaultQuery("limit", "5")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 20 {
		limit = 5
	}

	suggestions, err := h.toyService.GetSearchSuggestions(c.Request.Context(), query, limit)
	if err != nil {
		log.Error().Err(err).Msg("failed to get search suggestions")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "unable to load suggestions. please try again later.",
			"code":  "TOY_SERVICE_UNAVAILABLE",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": suggestions,
	})
}

func (h *ToyHandler) GetTypes(c *gin.Context) {
	toyTypes, err := h.toyService.GetTypes(c.Request.Context())
	if err != nil {
		log.Error().Err(err).Msg("failed to get toy types")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "unable to load toy types. please try again later.",
			"code":  "TOY_SERVICE_UNAVAILABLE",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": toyTypes,
	})
}
