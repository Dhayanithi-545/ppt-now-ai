/** Runtime configuration from the frontend's .env (Vite inlines VITE_* variables at build time). */

/** Base URL of the Aira API. Empty = same origin (dev proxy or a reverse proxy in front of both). */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

/** Absolute URL for API-relative assets such as /media/... images. */
export function assetUrl(url?: string): string | undefined {
  if (!url) return url
  return url.startsWith('/media/') ? API_BASE + url : url
}
