import { calculateCompoundingPenalty, PenaltyTier } from "../lib/penalty-calculations";

const tiers: PenaltyTier[] = [
  { minDays: 1, maxDays: 30, penaltyRate: 0.06 },
  { minDays: 31, maxDays: 60, penaltyRate: 0.09 },
  { minDays: 61, maxDays: 90, penaltyRate: 0.12 },
  { minDays: 91, maxDays: 120, penaltyRate: 0.15 },
  { minDays: 121, maxDays: 150, penaltyRate: 0.18 },
  { minDays: 151, maxDays: 360, penaltyRate: 0.21 },
  { minDays: 361, maxDays: 9999, penaltyRate: 0.24 },
];

// Peter misses 3 months`` (100k each)
// Inst 1: 90 days overdue (61-90 range -> 12%)
// Inst 2: 60 days overdue (31-60 range -> 9%)
// Inst 3: 30 days overdue (1-30 range -> 6%)

const installments = [
  { period: 1, principalArrears: 100000, interestArrears: 0, daysOverdue: 90 },
  { period: 2, principalArrears: 100000, interestArrears: 0, daysOverdue: 60 },
  { period: 3, principalArrears: 100000, interestArrears: 0, daysOverdue: 30 },
];

const penalty = calculateCompoundingPenalty(installments, tiers);

console.log("--- Penalty Calculation Test (Peter Example) ---");
console.log("Installments overdue (100k each): 90 days, 60 days, 30 days");
console.log(`Total Penalty Calculated: UGX ${penalty.toLocaleString()}`);

// Manual check:
// Month 1: 100k -> 6k (6%). Total = 106k.
// Month 2: (106k + 100k) = 206k -> 18,540 (9%). Total = 224,540.
// Month 3: (224,540 + 100k) = 324,540 -> 38,944.8 (12%). Total = 363,484.8
// Expected Total Penalty sum = 6,000 + 18,540 + 38,944.8 = 63,484.8

if (Math.abs(penalty - 63484.8) < 1) {
  console.log("✅ SUCCESS: Penalty calculation matches Peter's example exactly!");
} else {
  console.log(`❌ FAILURE: Expected ~63,484.8 but got ${penalty}`);
}
