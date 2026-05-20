/**
 * Single source of truth for runtime configuration.
 * Anything env-dependent (API hosts, feature flags) lives here so call sites
 * never hardcode URLs or magic numbers.
 *
 * Override at build time with VITE_API_BASE_URL=... in .env.production.
 */

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "https://repair.handatransportation.com/api/v1";

/** Build a full backend URL from a path like "/users/login". */
export const apiUrl = (path: string): string => {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
};

// ─── Auth ────────────────────────────────────────────────────────────────────
export const ACCESS_TOKEN_EXPIRES_DAYS = 1;
export const REFRESH_TOKEN_EXPIRES_DAYS = 7;
/** Endpoint that exchanges a refresh token for a fresh access token. Update if
 *  your backend uses a different path. If the call returns non-2xx, the user
 *  is logged out (current behavior). */
export const REFRESH_TOKEN_PATH = "/users/refresh-token";

// ─── Geolocation ─────────────────────────────────────────────────────────────
/** Cold-GPS friendly: 25s gives the device a real chance on first fix. */
export const GEO_TIMEOUT_MS = 25_000;
export const GEO_MAX_AGE_MS = 60_000;
