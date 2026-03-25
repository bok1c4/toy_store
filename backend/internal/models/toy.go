package models

// Toy represents a toy in the system
type Toy struct {
	ID          int    `json:"toyId"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Image       string `json:"imageUrl"`
	Price       int    `json:"price"`
	AgeGroup    string `json:"ageGroup"`
	Type        string `json:"type"`
	Permalink   string `json:"permalink"`
}

// SearchSuggestion represents a toy suggestion for autocomplete
type SearchSuggestion struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Type  string `json:"type"`
	Image string `json:"image"`
	Slug  string `json:"slug"`
}

// ToyExternal represents the external API response format
type ToyExternal struct {
	ToyID       int            `json:"toyId"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	ImageUrl    string         `json:"imageUrl"`
	Price       int            `json:"price"`
	AgeGroup    ExternalNested `json:"ageGroup"`
	Type        ExternalNested `json:"type"`
	Permalink   string         `json:"permalink"`
}

type ExternalNested struct {
	Name string `json:"name"`
}

// ToToy converts external format to internal Toy
func (te *ToyExternal) ToToy() Toy {
	return Toy{
		ID:          te.ToyID,
		Name:        te.Name,
		Description: te.Description,
		Image:       te.ImageUrl,
		Price:       te.Price,
		AgeGroup:    te.AgeGroup.Name,
		Type:        te.Type.Name,
		Permalink:   te.Permalink,
	}
}

type AgeGroup struct {
	ID   int    `json:"ageGroupId"`
	Name string `json:"name"`
}

type ToyType struct {
	ID   int    `json:"typeId"`
	Name string `json:"name"`
}

type ToyListResponse struct {
	Data  []Toy `json:"data"`
	Total int   `json:"total"`
	Page  int   `json:"page"`
}

type AgeGroupListResponse struct {
	Data []AgeGroup `json:"data"`
}

type ToyTypeListResponse struct {
	Data []ToyType `json:"data"`
}
