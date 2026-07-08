import { NextRequest, NextResponse } from "next/server";

/**
 * Simple in-memory rate limiter
 * For production, use Redis or a dedicated rate limiting service
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
}

export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = "Too many requests, please try again later",
    skipSuccessfulRequests = false,
  } = config;

  return async (request: NextRequest): Promise<NextResponse | null> => {
    // Get identifier (IP address or user ID from session)
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : "unknown";
    
    const key = `ratelimit:${ip}:${request.nextUrl.pathname}`;
    const now = Date.now();

    // Get or create rate limit entry
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    // Increment request count
    store[key].count++;

    // Check if limit exceeded
    if (store[key].count > maxRequests) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);
      
      return NextResponse.json(
        {
          success: false,
          error: message,
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(store[key].resetTime).toISOString(),
          },
        }
      );
    }

    // Add rate limit headers to response
    return null; // Continue to next middleware/handler
  };
}

/**
 * Predefined rate limit configurations
 */
export const RateLimits = {
  // Strict limit for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: "Too many login attempts, please try again later",
  },

  // Standard limit for API endpoints
  api: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 100,
  },

  // Strict limit for financial operations
  financial: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 30,
    message: "Too many financial transactions, please slow down",
  },

  // Lenient limit for read operations
  read: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 200,
  },
};

/**
 * Helper to add rate limit headers to any response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  ip: string,
  pathname: string,
  config: RateLimitConfig
): NextResponse {
  const key = `ratelimit:${ip}:${pathname}`;
  const entry = store[key];

  if (entry) {
    const remaining = Math.max(0, config.maxRequests - entry.count);
    response.headers.set("X-RateLimit-Limit", config.maxRequests.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", new Date(entry.resetTime).toISOString());
  }

  return response;
}
