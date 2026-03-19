export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  avatar_url?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JWTPayload {
  user_id: string;
  role: string;
  type: string;
  exp: number;
  iat: number;
}

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';

// Auth state change event for cross-component synchronization
export const AUTH_STATE_CHANGE_EVENT = 'auth-state-change';

export function notifyAuthStateChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_STATE_CHANGE_EVENT));
  }
}

export function saveTokens(accessToken: string, refreshToken: string): void {
  if (typeof window !== 'undefined') {
    // Save to localStorage for client-side access
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    
    // Also save to cookies for server-side middleware access
    document.cookie = `${ACCESS_TOKEN_KEY}=${accessToken}; path=/; max-age=604800`; // 7 days
    document.cookie = `${REFRESH_TOKEN_KEY}=${refreshToken}; path=/; max-age=604800`;
    
    notifyAuthStateChange();
  }
}

export function getAccessToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }
  return null;
}

export function clearTokens(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    
    // Clear cookies
    document.cookie = `${ACCESS_TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    document.cookie = `${REFRESH_TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    
    notifyAuthStateChange();
  }
}

export function saveUser(user: User): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    notifyAuthStateChange();
  }
}

export function getUser(): User | null {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem(USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr) as User;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = parts[1];
    const decoded = atob(payload);
    return JSON.parse(decoded) as JWTPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return true;
  }
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

export function isAuthenticated(): boolean {
  const token = getAccessToken();
  if (!token) {
    return false;
  }
  return !isTokenExpired(token);
}

export function getUserRole(): string | null {
  const token = getAccessToken();
  if (!token) {
    return null;
  }
  const payload = decodeJWT(token);
  return payload?.role ?? null;
}
