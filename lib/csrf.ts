import { NextRequest, NextResponse } from "next/server";

const CSRF_COOKIE = "csrf-token";
const CSRF_HEADER = "x-csrf-token";
const CSRF_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

// Paths that are exempt from CSRF (webhooks, public callbacks, auth endpoints)
const CSRF_EXEMPT_PATHS = [
  "/api/auth/",
  "/api/webhook",
  "/api/v1/momo/callback",
  "/api/v1/verification/",
  "/api/auth/forgot-password",
  "/api/auth/verify-otp",
  "/api/auth/reset-password",
  "/api/v1/auth/",
];

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function generateRandomHex(length: number): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateCsrfToken(): string {
  return generateRandomHex(32);
}

export function setCsrfCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false, // JS must read it
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 3600, // 1 hour
  });
  return response;
}

export function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some((p) => pathname.startsWith(p));
}

export function validateCsrf(request: NextRequest): boolean {
  // Only validate on mutating requests
  if (!CSRF_METHODS.includes(request.method)) return true;

  // Exempt paths (webhooks, auth flows)
  const pathname = request.nextUrl.pathname;
  if (isCsrfExempt(pathname)) return true;

  // First-party same-origin requests are safe (GET doesn't need CSRF)
  // Check for the CSRF token header sent by the client
  const headerToken = request.headers.get(CSRF_HEADER);
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;

  if (!headerToken || !cookieToken) return false;

  // Timing-safe comparison using Web Crypto
  try {
    const headerBuf = hexToUint8Array(headerToken);
    const cookieBuf = hexToUint8Array(cookieToken);
    return timingSafeEqual(headerBuf, cookieBuf);
  } catch {
    return false;
  }
}
