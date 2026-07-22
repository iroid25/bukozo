/**
 * Client-side fetch wrapper that automatically attaches the CSRF token header
 * read from the `csrf-token` cookie set by Next.js middleware.
 *
 * Usage:
 *   import { csrfFetch } from '@/lib/fetch-with-csrf';
 *   const res = await csrfFetch('/api/v1/withdrawals', { method: 'POST', body: JSON.stringify(data) });
 */

function getCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const METHODS_REQUIRING_CSRF = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function csrfFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method || "GET").toUpperCase();
  const headers = new Headers(init?.headers);

  if (METHODS_REQUIRING_CSRF.has(method)) {
    const token = getCsrfCookie();
    if (token) {
      headers.set("X-CSRF-Token", token);
    }
  }

  return fetch(input, { ...init, headers });
}
