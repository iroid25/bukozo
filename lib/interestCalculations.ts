/**
 * Interest Calculation Utilities
 * Based on SACCO interest calculation methods documentation
 */

export interface LoanCalculationInput {
  principal: number;
  interestRatePerMonth: number; // as percentage (e.g., 2.5 for 2.5%)
  periodMonths: number;
}

export interface MonthlyPayment {
  month: number;
  remainingPrincipal: number;
  principalPayment: number;
  interestPayment: number;
  totalPayment: number;
  balanceAfterPayment: number;
}

export interface LoanCalculationResult {
  monthlyPayments: MonthlyPayment[];
  totalPrincipal: number;
  totalInterest: number;
  totalAmount: number;
  averageMonthlyPayment: number;
}

/**
 * Calculate Flat Rate Interest
 * Interest remains constant throughout the loan period
 */
export function calculateFlatRate(input: LoanCalculationInput): LoanCalculationResult {
  const { principal, interestRatePerMonth, periodMonths } = input;
  
  // Interest per month = (rate/100) × Principal
  const interestPerMonth = (interestRatePerMonth / 100) * principal;
  
  // Total interest = Interest per month × Period
  const totalInterest = interestPerMonth * periodMonths;
  
  // Monthly installment = (Principal + Total interest) / Period
  const monthlyInstallment = (principal + totalInterest) / periodMonths;
  
  // Principal payment per month (constant)
  const principalPerMonth = principal / periodMonths;
  
  const monthlyPayments: MonthlyPayment[] = [];
  let remainingBalance = principal;
  
  for (let month = 1; month <= periodMonths; month++) {
    const payment: MonthlyPayment = {
      month,
      remainingPrincipal: remainingBalance,
      principalPayment: principalPerMonth,
      interestPayment: interestPerMonth,
      totalPayment: monthlyInstallment,
      balanceAfterPayment: remainingBalance - principalPerMonth,
    };
    
    monthlyPayments.push(payment);
    remainingBalance -= principalPerMonth;
  }
  
  return {
    monthlyPayments,
    totalPrincipal: principal,
    totalInterest,
    totalAmount: principal + totalInterest,
    averageMonthlyPayment: monthlyInstallment,
  };
}

/**
 * Calculate Reducing Balance Interest
 * Interest is applied on the remaining principal after each repayment
 */
export function calculateReducingBalance(input: LoanCalculationInput): LoanCalculationResult {
  const { principal, interestRatePerMonth, periodMonths } = input;
  
  const monthlyPayments: MonthlyPayment[] = [];
  let remainingPrincipal = principal;
  let remainingMonths = periodMonths;
  let totalInterest = 0;
  
  for (let month = 1; month <= periodMonths; month++) {
    // Interest payment = (rate/100) × Remaining Principal
    const interestPayment = (interestRatePerMonth / 100) * remainingPrincipal;
    
    // Principal payment = Remaining Principal / Remaining Months
    const principalPayment = remainingPrincipal / remainingMonths;
    
    // Total payment = Principal payment + Interest payment
    const totalPayment = principalPayment + interestPayment;
    
    const payment: MonthlyPayment = {
      month,
      remainingPrincipal,
      principalPayment,
      interestPayment,
      totalPayment,
      balanceAfterPayment: remainingPrincipal - principalPayment,
    };
    
    monthlyPayments.push(payment);
    
    totalInterest += interestPayment;
    remainingPrincipal -= principalPayment;
    remainingMonths--;
  }
  
  return {
    monthlyPayments,
    totalPrincipal: principal,
    totalInterest,
    totalAmount: principal + totalInterest,
    averageMonthlyPayment: (principal + totalInterest) / periodMonths,
  };
}

/**
 * Compare both methods and return savings
 */
export function compareInterestMethods(input: LoanCalculationInput) {
  const flatRate = calculateFlatRate(input);
  const reducingBalance = calculateReducingBalance(input);
  
  const interestSavings = flatRate.totalInterest - reducingBalance.totalInterest;
  const savingsPercentage = (interestSavings / flatRate.totalInterest) * 100;
  
  return {
    flatRate,
    reducingBalance,
    interestSavings,
    savingsPercentage,
  };
}

/**
 * Format currency for UGX
 */
export function formatUGX(amount: number): string {
  return `UGX ${Math.round(amount).toLocaleString()}`;
}
