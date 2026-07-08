import { format } from "date-fns";

export const SACCO_NAME = "BUKONZO UNITED TEACHERS SACCO";
export const BRANCH_LABEL = "KISINGA Kasese District";

export function toNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function formatUGX(value: unknown): string {
  const amount = Math.round(toNumber(value));
  const absolute = Math.abs(amount).toLocaleString("en-UG", { maximumFractionDigits: 0 });
  return amount < 0 ? `-UGX ${absolute}` : `UGX ${absolute}`;
}

export function formatUGXPlain(value: unknown): string {
  return Math.round(toNumber(value)).toLocaleString("en-UG", { maximumFractionDigits: 0 });
}

export function formatDate(value?: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "dd/MM/yyyy");
}

export function formatDateTime(value?: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "dd/MM/yyyy HH:mm:ss");
}

export function getDateOnly(value: Date | string): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function inferProductCode(accountNumber?: string | null, fallback = ""): string {
  if (!accountNumber) return fallback;
  const [prefix] = accountNumber.split(".");
  return prefix || fallback;
}

export function inferSavingsProductName(code: string): string {
  switch (code) {
    case "201001":
      return "FIXED DEPOSIT SAVINGS";
    case "201002":
      return "JUNIOR SAVINGS A/C";
    case "201003":
      return "VOLUNTARY SAVINGS";
    case "201004":
      return "COMPULSORY SAVINGS";
    case "200600":
      return "LOAN INSURANCE";
    case "200800":
      return "TARGET SAVINGS";
    case "200810":
      return "SCHOOL FEES SAVINGS";
    default:
      return code ? `SAVINGS ${code}` : "SAVINGS";
  }
}

export function inferShareProductName(code: string): string {
  switch (code) {
    case "300501":
      return "AFFILIATE MEMBERS";
    case "300502":
      return "ORDINARY MEMBERS";
    case "300503":
      return "ASSOCIATE MEMBERS";
    case "300504":
      return "SHARE CAPITAL";
    default:
      return code ? `SHARES ${code}` : "SHARES";
  }
}

export function inferMemberTypeFromShareCode(code?: string | null): string {
  switch (code) {
    case "300501":
      return "Affiliate";
    case "300502":
      return "Ordinary";
    case "300503":
      return "Associate";
    default:
      return "Ordinary";
  }
}

export function phoneLooksSuspicious(phone?: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length > 0 && digits.length !== 10;
}

export function generateDescription(trxCode: string, voucherText?: string | null): string {
  const code = normalize(trxCode).toUpperCase();
  const voucher = (voucherText || "").trim();
  const normalizedVoucher = normalize(voucher);

  if (code === "SD" && normalizedVoucher === "sd mobile") {
    return "Mobile Money Deposit";
  }

  switch (code) {
    case "SD":
      return "Savings Deposit";
    case "SW":
      return "Savings Withdrawal";
    case "SWF":
      return "Savings Withdrawal Fee";
    case "LP":
      return voucher ? `Loan Repayment — ${voucher}` : "Loan Repayment";
    case "GJ":
      return voucher ? `Journal Entry — ${voucher}` : "Journal Entry";
    case "AOF":
      return "Account Opening Fee";
    case "CAF":
      return "Client Application Fee";
    case "LAF":
      return "Loan Application Fee";
    case "R2T":
      return "Float Transfer (Reserve to Teller)";
    case "T2R":
      return "Float Return (Teller to Reserve)";
    case "SDMOBILE":
      return "Mobile Money Deposit";
    default:
      return voucher ? `${code} — ${voucher}` : code || "Transaction";
  }
}

export function formatRankDisplay(rank: number, name: string): string {
  return `${rank}.  ${name}`;
}

