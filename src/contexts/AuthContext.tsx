import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import {
  API_BASE_URL,
  ACCESS_TOKEN_EXPIRES_DAYS,
  REFRESH_TOKEN_EXPIRES_DAYS,
  REFRESH_TOKEN_PATH,
  apiUrl,
} from '../config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'technician';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  /** True once the provider has read cookies on mount. Use this to gate
   *  redirects so logged-in users don't briefly bounce to /login on first
   *  paint. */
  isHydrated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string, role: 'admin' | 'technician') => Promise<boolean>;
  logout: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COOKIE_KEYS = {
  USER: 'user',
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const;

// ─── Cookie Helpers ───────────────────────────────────────────────────────────

// fleet.handatransportation.com → repair.handatransportation.com is cross-origin,
// so SameSite=None; Secure is required for the cookie to be sent on those requests.
function setCookie(name: string, value: string, days: number) {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=None; Secure`;
}

function getCookie(name: string): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function deleteCookie(name: string) {
  // Delete must use the same SameSite=None; Secure attributes — otherwise mobile
  // browsers won't expire the original cookie.
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=None; Secure`;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  /** Coalesces concurrent refreshes so 5 in-flight requests don't all POST
   *  /refresh-token in parallel and race each other. */
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    const savedUser = getCookie(COOKIE_KEYS.USER);
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        clearCookies();
      }
    }
    setIsHydrated(true);
  }, []);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function saveSession(userData: User, accessToken: string, refreshToken: string) {
    setCookie(COOKIE_KEYS.USER, JSON.stringify(userData), REFRESH_TOKEN_EXPIRES_DAYS);
    setCookie(COOKIE_KEYS.ACCESS_TOKEN, accessToken, ACCESS_TOKEN_EXPIRES_DAYS);
    setCookie(COOKIE_KEYS.REFRESH_TOKEN, refreshToken, REFRESH_TOKEN_EXPIRES_DAYS);
    setUser(userData);
  }

  function clearCookies() {
    deleteCookie(COOKIE_KEYS.USER);
    deleteCookie(COOKIE_KEYS.ACCESS_TOKEN);
    deleteCookie(COOKIE_KEYS.REFRESH_TOKEN);
  }

  // ─── Refresh-token rotation ───────────────────────────────────────────────
  // Tries to swap the refresh token for a fresh access token. Returns the new
  // access token on success, or null on any failure (404/expired/network).
  // If the backend endpoint doesn't exist yet, this fails gracefully and the
  // caller falls back to logging the user out — same as before this change.

  async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = getCookie(COOKIE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) return null;

    try {
      const res = await fetch(apiUrl(REFRESH_TOKEN_PATH), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return null;

      const result = await res.json().catch(() => null);
      // Backend currently returns a flat shape `{accessToken, refreshToken}`
      // matching /login. Older versions wrapped it as ApiResponse —
      // `{data: {accessToken, refreshToken}}` — so we accept either to keep
      // this resilient across deploys where frontend ships before backend.
      const payload = result?.accessToken ? result : result?.data;
      if (!payload?.accessToken) return null;

      // Store the new access token; rotate refresh token if backend returned one.
      setCookie(COOKIE_KEYS.ACCESS_TOKEN, payload.accessToken, ACCESS_TOKEN_EXPIRES_DAYS);
      if (payload.refreshToken) {
        setCookie(COOKIE_KEYS.REFRESH_TOKEN, payload.refreshToken, REFRESH_TOKEN_EXPIRES_DAYS);
      }
      return payload.accessToken as string;
    } catch {
      return null;
    }
  }

  // ─── authFetch ────────────────────────────────────────────────────────────
  // Wraps fetch() with bearer-token injection and one-shot refresh-on-401.
  // Mobile browsers may strip third-party cookies, so the token also rides in
  // the Authorization header — header path is the source of truth.
  //
  // ✅ Wrapped in useCallback with empty deps so the function reference is
  //    stable across renders. Consumers like ReportsPage use this in useEffect
  //    deps — without stability, every parent re-render would refire every
  //    GET on every tab.
  //
  //    Safety note: this closure captures `refreshAccessToken` and `logout`
  //    from the first render. Both are state-independent (they only touch
  //    cookies + the stable `setUser` setter + a ref), so behavior is
  //    identical across renders. eslint-disable below is intentional.

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const send = (token: string | null): Promise<Response> => {
      const isFormData = options.body instanceof FormData;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { headers: _drop, ...restOptions } = options;
      const finalHeaders: Record<string, string> = {
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      };
      return fetch(url, {
        ...restOptions,
        headers: finalHeaders,
        credentials: 'include',
      });
    };

    const initialToken = getCookie(COOKIE_KEYS.ACCESS_TOKEN);
    const response = await send(initialToken);

    if (response.status !== 401) return response;

    // 401 → try once to refresh. Coalesce concurrent refreshes.
    if (!refreshInFlight.current) {
      refreshInFlight.current = refreshAccessToken().finally(() => {
        refreshInFlight.current = null;
      });
    }
    const newToken = await refreshInFlight.current;

    if (!newToken) {
      logout();
      return response;
    }

    // Retry the original request once with the fresh token.
    const retried = await send(newToken);
    if (retried.status === 401) logout();
    return retried;
  }, []);

  // ─── Login ────────────────────────────────────────────────────────────────

  async function login(email: string, password: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.user) {
        console.error('Login failed:', result?.message ?? 'Unknown error');
        return false;
      }

      saveSession(result.user, result.accessToken, result.refreshToken);
      return true;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    }
  }

  // ─── Register ─────────────────────────────────────────────────────────────

  async function register(
    name: string,
    email: string,
    password: string,
    role: 'admin' | 'technician'
  ): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error(result.message);
        return false;
      }

      saveSession(result.user, result.accessToken, result.refreshToken);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  function logout() {
    setUser(null);
    clearCookies();
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isHydrated,
        login,
        register,
        logout,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
