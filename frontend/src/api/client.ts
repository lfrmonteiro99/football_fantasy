// =============================================================================
// Axios HTTP Client — Football Fantasy Manager
// =============================================================================
// Single Axios instance configured for the Laravel API. All API calls go
// through this client so auth tokens, base URL, and error handling are
// centralised in one place.
// =============================================================================

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// ---------------------------------------------------------------------------
// Base instance
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30_000, // 30 seconds default; simulation endpoints may need more
});

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'ff_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Request interceptor — attach Bearer token
// ---------------------------------------------------------------------------

client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor — normalise errors, handle 401
// ---------------------------------------------------------------------------

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear local state.
      clearStoredToken();
      // Redirect to login if not already there.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default client;
