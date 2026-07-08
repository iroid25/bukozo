/**
 * Interest Configuration Service
 * Provides utilities to fetch and apply system-wide interest configuration
 */

import { db } from "@/prisma/db";

export interface SystemInterestConfig {
  defaultInterestType: "FLAT_RATE" | "REDUCING_BALANCE";
  defaultLoanInterestRate: number;
  maxInterestRate: number;
  minInterestRate: number;
  allowInterestTypeOverride: boolean;
  savingsInterestRate: number;
  fixedDepositInterestRate: number;
}

/**
 * Fetch system interest configuration
 * Returns default values if configuration doesn't exist in database
 */
export async function getInterestConfiguration(): Promise<SystemInterestConfig> {
  try {
    // Check if SystemConfiguration table exists
    const tableExists = await db.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'SystemConfiguration'
      );
    `.catch(() => ({ exists: false }));

    if (!tableExists || !(tableExists as any)[0]?.exists) {
      console.warn("⚠️ SystemConfiguration table doesn't exist. Using default values.");
      return getDefaultConfiguration();
    }

    // Fetch all interest-related configuration
    const configs = await db.systemConfiguration.findMany({
      where: {
        category: "INTEREST",
      },
    });

    if (configs.length === 0) {
      console.warn("⚠️ No interest configuration found. Using default values.");
      return getDefaultConfiguration();
    }

    // Parse configuration values
    const config: SystemInterestConfig = {
      defaultInterestType: parseConfigValue(configs, "DEFAULT_INTEREST_TYPE", "FLAT_RATE") as "FLAT_RATE" | "REDUCING_BALANCE",
      defaultLoanInterestRate: parseConfigValue(configs, "DEFAULT_LOAN_INTEREST_RATE", 15),
      maxInterestRate: parseConfigValue(configs, "MAX_INTEREST_RATE", 100),
      minInterestRate: parseConfigValue(configs, "MIN_INTEREST_RATE", 0),
      allowInterestTypeOverride: parseConfigValue(configs, "ALLOW_INTEREST_TYPE_OVERRIDE", true),
      savingsInterestRate: parseConfigValue(configs, "SAVINGS_INTEREST_RATE", 5),
      fixedDepositInterestRate: parseConfigValue(configs, "FIXED_DEPOSIT_INTEREST_RATE", 8),
    };

    return config;
  } catch (error) {
    console.error("Error fetching interest configuration:", error);
    return getDefaultConfiguration();
  }
}

/**
 * Get default configuration values
 */
function getDefaultConfiguration(): SystemInterestConfig {
  return {
    defaultInterestType: "FLAT_RATE",
    defaultLoanInterestRate: 15,
    maxInterestRate: 100,
    minInterestRate: 0,
    allowInterestTypeOverride: true,
    savingsInterestRate: 5,
    fixedDepositInterestRate: 8,
  };
}

/**
 * Parse configuration value from database
 */
function parseConfigValue(
  configs: Array<{ key: string; value: string }>,
  key: string,
  defaultValue: any
): any {
  const config = configs.find((c) => c.key === key);
  if (!config) return defaultValue;

  // Parse based on type of default value
  if (typeof defaultValue === "number") {
    return parseFloat(config.value) || defaultValue;
  }
  if (typeof defaultValue === "boolean") {
    return config.value === "true" || config.value === "1";
  }
  return config.value || defaultValue;
}

/**
 * Calculate loan interest based on system configuration
 */
export async function calculateLoanInterest(
  principal: number,
  periodMonths: number,
  interestRateOverride?: number,
  interestTypeOverride?: "FLAT_RATE" | "REDUCING_BALANCE",
  interestPeriod: "MONTHLY" | "ANNUAL" = "MONTHLY"
): Promise<{
  interestType: "FLAT_RATE" | "REDUCING_BALANCE";
  interestRate: number;
  totalInterest: number;
  totalAmount: number;
  monthlyPayment: number;
}> {
  const config = await getInterestConfiguration();

  // Use override if allowed, otherwise use system defaults
  const interestType = config.allowInterestTypeOverride && interestTypeOverride
    ? interestTypeOverride
    : config.defaultInterestType;

  const interestRate = interestRateOverride || config.defaultLoanInterestRate;
  const effectiveMonthlyRate = interestPeriod === "ANNUAL" ? interestRate / 12 : interestRate;

  // Validate interest rate is within limits
  if (interestRate < config.minInterestRate || interestRate > config.maxInterestRate) {
    throw new Error(
      `Interest rate must be between ${config.minInterestRate}% and ${config.maxInterestRate}%`
    );
  }

  let totalInterest: number;
  let monthlyPayment: number;

  if (interestType === "FLAT_RATE") {
    // Flat Rate: Interest per month = (rate/100) × Principal
    const interestPerMonth = (effectiveMonthlyRate / 100) * principal;
    totalInterest = interestPerMonth * periodMonths;
    monthlyPayment = (principal + totalInterest) / periodMonths;
  } else {
    // Reducing Balance: Interest calculated on remaining balance
    let remainingPrincipal = principal;
    let remainingMonths = periodMonths;
    totalInterest = 0;
    let totalPayment = 0;

    for (let month = 1; month <= periodMonths; month++) {
      const interestPayment = (effectiveMonthlyRate / 100) * remainingPrincipal;
      const principalPayment = remainingPrincipal / remainingMonths;
      
      totalInterest += interestPayment;
      totalPayment += principalPayment + interestPayment;
      
      remainingPrincipal -= principalPayment;
      remainingMonths--;
    }

    monthlyPayment = totalPayment / periodMonths;
  }

  return {
    interestType,
    interestRate,
    totalInterest,
    totalAmount: principal + totalInterest,
    monthlyPayment,
  };
}
