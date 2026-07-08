import { calculateLoanSchedule } from "../lib/loan-calculations";

// Test 1: ANNUAL period - 30% rate (should give 25,000/month)
const testAnnual = {
  amountGranted: 1000000,
  interestRate: 30,
  repaymentPeriodMonths: 3,
  interestType: "FLAT_RATE" as const,
  interestPeriod: "ANNUAL" as const,
  scheduleFrequency: "MONTHLY" as const,
};

console.log("=== TEST 1: ANNUAL Period with 30% ===");
console.log("Input:", testAnnual);
const resultAnnual = calculateLoanSchedule(testAnnual);
console.log("Total Interest:", resultAnnual.totalInterest);
console.log("Monthly Interest:", resultAnnual.schedule[0].interestPayment);

// Test 2: MONTHLY period - 30% rate (should give 300,000/month - WRONG!)
const testMonthly = {
  amountGranted: 1000000,
  interestRate: 30,
  repaymentPeriodMonths: 3,
  interestType: "FLAT_RATE" as const,
  interestPeriod: "MONTHLY" as const,
  scheduleFrequency: "MONTHLY" as const,
};

console.log("\n=== TEST 2: MONTHLY Period with 30% ===");
console.log("Input:", testMonthly);
const resultMonthly = calculateLoanSchedule(testMonthly);
console.log("Total Interest:", resultMonthly.totalInterest);
console.log("Monthly Interest:", resultMonthly.schedule[0].interestPayment);

// Test 3: What if rate should be 2.5% for monthly?
const testMonthlyCorrect = {
  amountGranted: 1000000,
  interestRate: 2.5,
  repaymentPeriodMonths: 3,
  interestType: "FLAT_RATE" as const,
  interestPeriod: "MONTHLY" as const,
  scheduleFrequency: "MONTHLY" as const,
};

console.log("\n=== TEST 3: MONTHLY Period with 2.5% ===");
console.log("Input:", testMonthlyCorrect);
const resultMonthlyCorrect = calculateLoanSchedule(testMonthlyCorrect);
console.log("Total Interest:", resultMonthlyCorrect.totalInterest);
console.log(
  "Monthly Interest:",
  resultMonthlyCorrect.schedule[0].interestPayment,
);

// Now let's reverse engineer what rate would give 400,800 monthly interest
// For FLAT rate: monthlyInterest = (principal * monthlyRate)
// So: 400800 = 1000000 * monthlyRate
// monthlyRate = 400800 / 1000000 = 0.4008 = 40.08%

console.log("\n=== ANALYSIS ===");
console.log("If monthly interest is 400,800 on 1,000,000 principal:");
console.log("That would require a rate of 40.08% per month!");
console.log("Or if using ANNUAL period: 40.08 * 12 = 480.96% annual rate!");
