/**
 * Loan Calculation Helper with Interest Configuration Integration
 * This file provides utilities to calculate loan details using system interest configuration
 */

import { calculateLoanDetails } from "@/types/loanApplication";

export interface LoanCalculationParams {
  principal: number;
  repaymentPeriodMonths: number;
  interestRatePerMonth?: number;
  interestType?: "FLAT_RATE" | "REDUCING_BALANCE";
}

export interface LoanCalculationResult {
  principal: number;
  interest: number;
  totalAmountDue: number;
  monthlyPayment: number;
  interestType: "FLAT_RATE" | "REDUCING_BALANCE";
  interestRate: number;
}

/**
 * Calculate loan with interest configuration
 * Fetches system configuration if no override provided
 */
export async function calculateLoanWithConfig(
  params: LoanCalculationParams
): Promise<LoanCalculationResult> {
  let interestRate = params.interestRatePerMonth;
  let interestType = params.interestType;

  // If no override provided, fetch from configuration
  if (!interestRate || !interestType) {
    try {
      const response = await fetch("/api/v1/system/interest-config/client");
      if (response.ok) {
        const config = await response.json();
        interestRate = interestRate || config.defaultLoanInterestRate;
        interestType = interestType || config.defaultInterestType;
      }
    } catch (error) {
      console.error("Failed to fetch interest config, using defaults:", error);
      interestRate = interestRate || 2.5; // Default 2.5% per month
      interestType = interestType || "FLAT_RATE";
    }
  }

  // Ensure values are defined with defaults
  const finalInterestRate = interestRate ?? 2.5;
  const finalInterestType = (interestType ?? "FLAT_RATE") as "FLAT_RATE" | "REDUCING_BALANCE";

  const calculation = calculateLoanDetails(
    params.principal,
    finalInterestRate,
    params.repaymentPeriodMonths,
    finalInterestType
  );

  return {
    ...calculation,
    interestType: finalInterestType,
    interestRate: finalInterestRate,
  };
}

/**
 * Calculate loan synchronously (for real-time form updates)
 * Uses provided rates or defaults
 */
export function calculateLoanSync(
  principal: number,
  repaymentPeriodMonths: number,
  interestRatePerMonth: number = 2.5,
  interestType: "FLAT_RATE" | "REDUCING_BALANCE" = "FLAT_RATE"
): LoanCalculationResult {
  const calculation = calculateLoanDetails(
    principal,
    interestRatePerMonth,
    repaymentPeriodMonths,
    interestType
  );

  return {
    ...calculation,
    interestType,
    interestRate: interestRatePerMonth,
  };
}
