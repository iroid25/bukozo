/**
 * Penalty Calculation Utility
 * Implements the escalating, compounding penalty logic as per system configuration.
 */

export interface PenaltyTier {
  minDays: number;
  maxDays: number;
  penaltyRate: number; // e.g. 0.06 for 6%
}

export interface CompoundingPenaltyResult {
  totalPenaltyAccrued: number;
  penaltyByInstallment: Array<{
    period: number;
    amount: number;
    penalty: number;
    total: number;
  }>;
}

/**
 * Calculate the compounding penalty for a set of overdue installments.
 * Formula: Penalty for each month is based on (Unpaid Total + New Arrears)
 * 
 * @param installments Unpaid installments with their overdue days
 * @param tiers Penalty tiers from global configuration
 * @returns Compounding penalty result
 */
export function calculateCompoundingPenalty(
  installments: Array<{ period: number; principalArrears: number; interestArrears: number; daysOverdue: number }>,
  tiers: PenaltyTier[] = [
    { minDays: 1, maxDays: 30, penaltyRate: 0.06 },
    { minDays: 31, maxDays: 60, penaltyRate: 0.09 },
    { minDays: 61, maxDays: 90, penaltyRate: 0.12 },
    { minDays: 91, maxDays: 120, penaltyRate: 0.15 },
    { minDays: 121, maxDays: 150, penaltyRate: 0.18 },
    { minDays: 151, maxDays: 360, penaltyRate: 0.21 },
    { minDays: 361, maxDays: 9999, penaltyRate: 0.24 },
  ]
): number {
  if (installments.length === 0) return 0;

  // Sort installments by due date (ascending) so we process the oldest first
  const sorted = [...installments].sort((a, b) => b.daysOverdue - a.daysOverdue);

  let cumulativeTotalDue = 0;
  let totalPenalty = 0;

  for (const inst of sorted) {
    const installmentArrears = inst.principalArrears + inst.interestArrears;
    
    // New Base = Prior Running Total + Current Installment Arrears
    cumulativeTotalDue += installmentArrears;

    // Find the appropriate tier based on how long THIS installment has been overdue
    const tier = tiers.find(t => inst.daysOverdue >= t.minDays && inst.daysOverdue <= t.maxDays) 
               || tiers[tiers.length - 1]; // Fallback to last tier if > max defined

    const monthPenalty = cumulativeTotalDue * tier.penaltyRate;
    
    totalPenalty += monthPenalty;
    cumulativeTotalDue += monthPenalty; // Compounding: add the penalty to the running total
  }

  return Number(totalPenalty.toFixed(2));
}

/**
 * Fallback simple penalty calculation based on total outstanding balance
 * Used when detailed installment history isn't available (e.g. for simple on-the-fly estimates)
 */
export function calculateSimplePenaltyEstimation(
  outstandingBalance: number,
  daysOverdue: number,
  tiers: PenaltyTier[] = [
    { minDays: 1, maxDays: 30, penaltyRate: 0.06 },
    { minDays: 31, maxDays: 60, penaltyRate: 0.09 },
    { minDays: 61, maxDays: 90, penaltyRate: 0.12 },
    { minDays: 91, maxDays: 120, penaltyRate: 0.15 },
    { minDays: 121, maxDays: 150, penaltyRate: 0.18 },
    { minDays: 151, maxDays: 360, penaltyRate: 0.21 },
    { minDays: 361, maxDays: 9999, penaltyRate: 0.24 },
  ]
): number {
  if (daysOverdue <= 0) return 0;
  
  const tier = tiers.find(t => daysOverdue >= t.minDays && daysOverdue <= t.maxDays) 
             || (daysOverdue > 360 ? tiers[tiers.length - 1] : { penaltyRate: 0 });

  return Number((outstandingBalance * tier.penaltyRate).toFixed(2));
}
