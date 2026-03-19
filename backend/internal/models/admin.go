package models

// Analytics holds store-wide statistics for the admin dashboard.
type Analytics struct {
	TotalUsers   int64        `json:"total_users"`
	TotalOrders  int64        `json:"total_orders"`
	TotalRevenue float64      `json:"total_revenue"`
	OrdersPerDay []DailyOrder `json:"orders_per_day"`
	TopToys      []TopToy     `json:"top_toys"`
}

// DailyOrder is one row in the orders-per-day chart.
type DailyOrder struct {
	Date    string  `json:"date"`    // "2026-03-01"
	Count   int64   `json:"count"`
	Revenue float64 `json:"revenue"`
}

// TopToy is one row in the top-selling-toys chart.
type TopToy struct {
	ToyID     int    `json:"toy_id"`
	ToyName   string `json:"toy_name"`
	TotalSold int64  `json:"total_sold"`
}

// UserWithOrderCount wraps a User with their total order count.
type UserWithOrderCount struct {
	User       `json:",inline"`
	OrderCount int `json:"order_count"`
}

// AdminUpdateUserRequest is the body accepted by PUT /api/admin/users/:id.
type AdminUpdateUserRequest struct {
	IsActive *bool    `json:"is_active,omitempty"`
	Role     *string  `json:"role,omitempty" validate:"omitempty,oneof=user admin"`
}

// AdminUserListResponse is a paginated list of users for the admin panel.
type AdminUserListResponse struct {
	Data    []User `json:"data"`
	Total   int    `json:"total"`
	Page    int    `json:"page"`
	PerPage int    `json:"per_page"`
}

// AdminOrderListResponse is a paginated list of all orders for the admin panel.
type AdminOrderListResponse struct {
	Data    []OrderWithItems `json:"data"`
	Total   int              `json:"total"`
	Page    int              `json:"page"`
	PerPage int              `json:"per_page"`
}
