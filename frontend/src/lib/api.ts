import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, getRefreshToken, clearTokens, saveTokens, isTokenExpired } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { 
      refresh_token: refreshToken 
    });
    const { access_token, refresh_token } = response.data.data;
    saveTokens(access_token, refresh_token);
    return access_token;
  } catch {
    clearTokens();
    return null;
  }
};

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    
    if (token) {
      // If token is expired, we need to refresh before sending this request
      if (isTokenExpired(token)) {
        // If already refreshing, wait for it
        if (isRefreshing) {
          return new Promise((resolve) => {
            subscribeTokenRefresh((newToken: string) => {
              config.headers.Authorization = `Bearer ${newToken}`;
              resolve(config);
            });
          });
        }
        
        // Start refresh
        isRefreshing = true;
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        
        if (newToken) {
          onTokenRefreshed(newToken);
          config.headers.Authorization = `Bearer ${newToken}`;
        } else {
          // Refresh failed, redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return Promise.reject(new Error('Token refresh failed'));
        }
      } else {
        // Token is valid, use it
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // If 401 and not already retried, try to refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      // No refresh token means the user is not logged in — don't redirect, just reject
      if (!getRefreshToken()) {
        return Promise.reject(error);
      }

      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshAccessToken();
        isRefreshing = false;

        if (newToken) {
          onTokenRefreshed(newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } else {
          // Had a refresh token but it's no longer valid — redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      } else {
        // Wait for refresh to complete
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }
    }
    
    return Promise.reject(error);
  }
);
