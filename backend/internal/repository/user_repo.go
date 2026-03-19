package repository

import (
	"context"
	"fmt"

	"github.com/bok1c4/toy_store/backend/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := r.db.Exec(ctx, query,
		user.ID,
		user.Username,
		user.Email,
		user.PasswordHash,
		user.Role,
		user.IsActive,
		user.CreatedAt,
		user.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `
		SELECT id, username, email, password_hash, role, avatar_url, address, is_active, created_at, updated_at
		FROM users
		WHERE email = $1
	`

	var user models.User
	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.AvatarURL,
		&user.Address,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to find user by email: %w", err)
	}

	return &user, nil
}

func (r *UserRepository) FindByID(ctx context.Context, id string) (*models.User, error) {
	query := `
		SELECT id, username, email, password_hash, role, avatar_url, address, is_active, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	var user models.User
	err := r.db.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.AvatarURL,
		&user.Address,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to find user by id: %w", err)
	}

	return &user, nil
}

func (r *UserRepository) Update(ctx context.Context, id string, updates *models.UpdateUserRequest) (*models.User, error) {
	query := `
		UPDATE users
		SET username = COALESCE($2, username),
			avatar_url = COALESCE($3, avatar_url),
			address = COALESCE($4, address),
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, username, email, password_hash, role, avatar_url, address, is_active, created_at, updated_at
	`

	var user models.User
	err := r.db.QueryRow(ctx, query,
		id,
		updates.Username,
		updates.AvatarURL,
		updates.Address,
	).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.AvatarURL,
		&user.Address,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return &user, nil
}

func (r *UserRepository) UpdatePassword(ctx context.Context, id, newPasswordHash string) error {
	query := `
		UPDATE users
		SET password_hash = $2, updated_at = NOW()
		WHERE id = $1
	`

	_, err := r.db.Exec(ctx, query, id, newPasswordHash)
	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	return nil
}

// ListAll returns a paginated list of all users for admin use.
func (r *UserRepository) ListAll(ctx context.Context, page, perPage int) ([]models.User, int, error) {
	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count users: %w", err)
	}

	offset := (page - 1) * perPage
	rows, err := r.db.Query(ctx, `
		SELECT id, username, email, password_hash, role, avatar_url, address, is_active, created_at, updated_at
		FROM users
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`, perPage, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list users: %w", err)
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var u models.User
		if err := rows.Scan(
			&u.ID, &u.Username, &u.Email, &u.PasswordHash,
			&u.Role, &u.AvatarURL, &u.Address, &u.IsActive,
			&u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, u)
	}
	if err = rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating users: %w", err)
	}

	return users, total, nil
}

// UpdateAdmin updates a user's is_active flag or role (admin-only operation).
func (r *UserRepository) UpdateAdmin(ctx context.Context, id string, isActive *bool, role *models.UserRole) (*models.User, error) {
	var user models.User
	err := r.db.QueryRow(ctx, `
		UPDATE users
		SET is_active  = COALESCE($2, is_active),
		    role       = COALESCE($3, role),
		    updated_at = NOW()
		WHERE id = $1
		RETURNING id, username, email, password_hash, role, avatar_url, address, is_active, created_at, updated_at
	`, id, isActive, role).Scan(
		&user.ID, &user.Username, &user.Email, &user.PasswordHash,
		&user.Role, &user.AvatarURL, &user.Address, &user.IsActive,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}
	return &user, nil
}

func (r *UserRepository) FindByUsername(ctx context.Context, username string) (*models.User, error) {
	query := `
		SELECT id, username, email, password_hash, role, avatar_url, address, is_active, created_at, updated_at
		FROM users
		WHERE username = $1
	`

	var user models.User
	err := r.db.QueryRow(ctx, query, username).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.AvatarURL,
		&user.Address,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to find user by username: %w", err)
	}

	return &user, nil
}
