import { z } from "zod";
import { isValidNin, normalizeNin } from "@/lib/identity";

/**
 * Comprehensive validation schemas for all financial operations
 */

// Common schemas
export const UUIDSchema = z.string().uuid("Invalid ID format");
export const PositiveNumberSchema = z.number().positive("Amount must be positive");
export const NonNegativeNumberSchema = z.number().nonnegative("Amount cannot be negative");
export const PhoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number");
export const EmailSchema = z.string().email("Invalid email address");
export const DateSchema = z.coerce.date();

// Withdrawal validation
export const WithdrawalSchema = z.object({
  accountId: UUIDSchema,
  memberId: UUIDSchema.optional(),
  amount: PositiveNumberSchema.max(100000000, "Amount too large"),
  channel: z.enum(["CASH", "MOBILE_MONEY", "BANK"], {
    errorMap: () => ({ message: "Invalid channel" }),
  }),
  mobileMoneyRef: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  fingerprintVerified: z.boolean().optional(),
  fingerprintMatchScore: z.number().int().min(0).max(199).optional(),
});

// Deposit validation
export const DepositSchema = z.object({
  accountId: UUIDSchema,
  memberId: UUIDSchema.optional(),
  institutionId: UUIDSchema.optional(),
  amount: PositiveNumberSchema.max(100000000, "Amount too large"),
  channel: z.enum(["CASH", "MOBILE_MONEY", "BANK"]),
  depositType: z.enum(["DIRECT", "FEE_PAYMENT"]).optional(),
  depositorName: z.string().max(200).optional(),
  mobileMoneyRef: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  feeType: z.string().max(100).optional(),
  studentName: z.string().max(200).optional(),
  studentClass: z.string().max(50).optional(),
  studentYear: z.string().max(20).optional(),
});

// Transfer validation
export const TransferSchema = z.object({
  sourceAccountId: UUIDSchema,
  targetAccountId: UUIDSchema,
  amount: PositiveNumberSchema.max(100000000, "Amount too large"),
  description: z.string().max(500).optional(),
}).refine((data) => data.sourceAccountId !== data.targetAccountId, {
  message: "Source and target accounts must be different",
  path: ["targetAccountId"],
});

// Loan repayment validation
export const LoanRepaymentSchema = z.object({
  loanId: UUIDSchema,
  amount: PositiveNumberSchema.max(100000000, "Amount too large"),
  channel: z.enum(["CASH", "MOBILE_MONEY", "BANK"]),
  mobileMoneyRef: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
});

// Member creation validation
export const MemberCreateSchema = z.object({
  firstName: z.string().min(2, "First name too short").max(100),
  lastName: z.string().min(2, "Last name too short").max(100),
  email: EmailSchema.optional(),
  phone: PhoneSchema.optional(),
  dateOfBirth: DateSchema.optional(),
  registrationDate: DateSchema.optional(),
  address: z.string().max(500).optional(),
  nationalId: z
    .string()
    .optional()
    .nullable()
    .transform((value) => normalizeNin(value))
    .refine((value) => value === null || isValidNin(value), {
      message: "NIN must start with CM or CF and be 14 characters long",
    }),
  idCard: z
    .string()
    .optional()
    .nullable()
    .transform((value) => normalizeNin(value))
    .refine((value) => value === null || isValidNin(value), {
      message: "NIN must start with CM or CF and be 14 characters long",
    }),
  branchId: UUIDSchema,
}).refine((data) => data.email || data.phone, {
  message: "Either email or phone must be provided",
  path: ["email"],
});

// Account creation validation
export const AccountCreateSchema = z.object({
  memberId: UUIDSchema.optional(),
  institutionId: UUIDSchema.optional(),
  accountTypeId: UUIDSchema,
  branchId: UUIDSchema,
  initialDeposit: NonNegativeNumberSchema.optional(),
}).refine((data) => data.memberId || data.institutionId, {
  message: "Either memberId or institutionId must be provided",
  path: ["memberId"],
});

// Login validation
export const LoginSchema = z.object({
  email: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required"),
});

// Password validation
export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

// Change password validation
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: PasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Pagination validation
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Date range validation
export const DateRangeSchema = z.object({
  startDate: DateSchema.optional(),
  endDate: DateSchema.optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  {
    message: "Start date must be before end date",
    path: ["endDate"],
  }
);

/**
 * Helper function to validate and parse data
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: true;
  data: T;
  errors?: never;
} | {
  success: false;
  data?: never;
  errors: z.ZodError;
} {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}

/**
 * Format Zod errors for API response
 */
export function formatZodErrors(errors: z.ZodError): string {
  return errors.errors
    .map((err) => `${err.path.join(".")}: ${err.message}`)
    .join(", ");
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove < and >
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, ""); // Remove event handlers
}

/**
 * Validate file upload
 */
export const FileUploadSchema = z.object({
  name: z.string(),
  size: z.number().max(5 * 1024 * 1024, "File size must be less than 5MB"),
  type: z.enum([
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ], {
    errorMap: () => ({ message: "Invalid file type" }),
  }),
});
