import { NextResponse } from "next/server";

/**
 * Standard API Response Utilities
 * Use these to ensure consistent response format across all APIs
 */

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Error codes for consistent error handling
 */
export enum ApiErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  ACCOUNT_INACTIVE = "ACCOUNT_INACTIVE",
  FLOAT_INSUFFICIENT = "FLOAT_INSUFFICIENT",
  MIN_BALANCE_VIOLATION = "MIN_BALANCE_VIOLATION",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DUPLICATE_TRANSACTION = "DUPLICATE_TRANSACTION",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
}

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
    },
    { status }
  );
}

/**
 * Create an error response
 */
export function errorResponse(
  error: string,
  code?: ApiErrorCode | string,
  status: number = 400,
  details?: any
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(code && { code }),
      ...(details && { details }),
    },
    { status }
  );
}

/**
 * Common error responses
 */
export const ApiErrors = {
  unauthorized: (message: string = "Unauthorized") =>
    errorResponse(message, ApiErrorCode.UNAUTHORIZED, 401),

  forbidden: (message: string = "Insufficient permissions") =>
    errorResponse(message, ApiErrorCode.FORBIDDEN, 403),

  notFound: (resource: string = "Resource") =>
    errorResponse(`${resource} not found`, ApiErrorCode.NOT_FOUND, 404),

  validationError: (message: string) =>
    errorResponse(message, ApiErrorCode.VALIDATION_ERROR, 400),

  insufficientBalance: (required: number, available: number) =>
    errorResponse(
      `Insufficient balance. Required: ${required.toLocaleString()}, Available: ${available.toLocaleString()}`,
      ApiErrorCode.INSUFFICIENT_BALANCE,
      400
    ),

  accountInactive: () =>
    errorResponse("Account is not active", ApiErrorCode.ACCOUNT_INACTIVE, 400),

  floatInsufficient: (required: number, available: number) =>
    errorResponse(
      `Insufficient float. Required: ${required.toLocaleString()}, Available: ${available.toLocaleString()}`,
      ApiErrorCode.FLOAT_INSUFFICIENT,
      400
    ),

  minBalanceViolation: (minBalance: number) =>
    errorResponse(
      `Operation would violate minimum balance requirement of ${minBalance.toLocaleString()}`,
      ApiErrorCode.MIN_BALANCE_VIOLATION,
      400
    ),

  internalError: (message: string = "Internal server error") =>
    errorResponse(message, ApiErrorCode.INTERNAL_ERROR, 500),
};

/**
 * Pagination helper
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function getPaginationParams(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  
  return { page, limit };
}

export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Validate required fields
 */
export function validateRequired(
  body: any,
  fields: string[]
): string | null {
  for (const field of fields) {
    if (!body[field]) {
      return `${field} is required`;
    }
  }
  return null;
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, "");
}
