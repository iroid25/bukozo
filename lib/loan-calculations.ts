export interface RepaymentScheduleItem {
  period: number;
  dueDate: Date;
  principalPayment: number;
  interestPayment: number;
  totalPayment: number;
  remainingBalance: number;
  paidAmount?: number;
  status?: "PAID" | "PARTIAL" | "PENDING";
}

export interface LoanPayment {
  amount: number;
  paymentDate: Date;
  principalPaid: number;
  interestPaid: number;
  penaltyPaid: number;
}

export interface LoanCalculationResult {
  schedule: RepaymentScheduleItem[];
  totalPrincipal: number;
  totalInterest: number;
  totalAmountRepaid: number;
}

export type ScheduleFrequency =
  | "BI_WEEKLY"
  | "MONTHLY"
  | "EVERY_TWO_MONTHS"
  | "QUARTERLY"
  | "HALF_YEAR";

/**
 * Convert schedule frequency to months interval
 */
export function frequencyToMonths(frequency: ScheduleFrequency): number {
  switch (frequency) {
    case "BI_WEEKLY":
      return 0.5;
    case "MONTHLY":
      return 1;
    case "EVERY_TWO_MONTHS":
      return 2;
    case "QUARTERLY":
      return 3;
    case "HALF_YEAR":
      return 6;
    default:
      return 1;
  }
}

/**
 * Advance a date by the given frequency interval
 */
function advanceDateByFrequency(
  date: Date,
  frequency: ScheduleFrequency,
): void {
  if (isNaN(date.getTime())) {
    date.setTime(Date.now());
  }
  switch (frequency) {
    case "BI_WEEKLY":
      date.setDate(date.getDate() + 14);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + 1);
      break;
    case "EVERY_TWO_MONTHS":
      date.setMonth(date.getMonth() + 2);
      break;
    case "QUARTERLY":
      date.setMonth(date.getMonth() + 3);
      break;
    case "HALF_YEAR":
      date.setMonth(date.getMonth() + 6);
      break;
  }
  if (isNaN(date.getTime())) {
    date.setTime(Date.now());
  }
}

/**
 * Calculate number of schedule periods based on loan duration and frequency
 */
export function calculatePeriodCount(
  repaymentPeriodMonths: number,
  frequency: ScheduleFrequency,
): number {
  if (frequency === "BI_WEEKLY") {
    // Approximate: ~4.33 bi-weekly periods per month
    return Math.round(repaymentPeriodMonths * (30 / 14));
  }
  const interval = frequencyToMonths(frequency);
  return Math.max(1, Math.round(repaymentPeriodMonths / interval));
}

/**
 * Calculate loan schedule using Flat Rate method
 */
export function calculateFlatRateSchedule(
  principal: number,
  monthlyRatePercent: number,
  periodMonths: number,
  gracePeriod: number = 0,
  startDate: Date = new Date(),
  payments: LoanPayment[] = [],
  scheduleFrequency: ScheduleFrequency = "MONTHLY",
): LoanCalculationResult {
  const frequencyInterval = frequencyToMonths(scheduleFrequency);
  const totalPeriods = calculatePeriodCount(periodMonths, scheduleFrequency);
  const gracePeriods =
    scheduleFrequency === "BI_WEEKLY"
      ? Math.round(gracePeriod * (30 / 14))
      : Math.max(0, Math.round(gracePeriod / frequencyInterval));

  // Total interest calculation for Flat Rate: Correctly use (Principal * MonthlyRate * Months)
  const totalInterestAmount = Math.round(principal * (monthlyRatePercent / 100) * periodMonths);
  const principalPerPeriod = Math.round(principal / totalPeriods);
  const interestPerPeriod = Math.round(totalInterestAmount / totalPeriods);
  const totalPerPeriod = principalPerPeriod + interestPerPeriod;

  const schedule: RepaymentScheduleItem[] = [];
  let actualRemainingBalance = principal;
  let currentPeriod = 1;
  const rollingDate = new Date(startDate);

  const sortedPayments = [...payments].sort(
    (a, b) => a.paymentDate.getTime() - b.paymentDate.getTime(),
  );
  let paymentIndex = 0;

  // Grace Period: Interest Only
  for (let i = 0; i < gracePeriods; i++) {
    const periodDueDate = new Date(rollingDate);

    const nextPeriodDate = new Date(periodDueDate);
    advanceDateByFrequency(nextPeriodDate, scheduleFrequency);

    let paidInPeriod = 0;
    while (
      paymentIndex < sortedPayments.length &&
      sortedPayments[paymentIndex].paymentDate < nextPeriodDate
    ) {
      paidInPeriod += sortedPayments[paymentIndex].amount;
      actualRemainingBalance -= sortedPayments[paymentIndex].principalPaid || 0;
      paymentIndex++;
    }

    const graceInterest = totalInterestAmount / (totalPeriods + gracePeriods);

    schedule.push({
      period: currentPeriod++,
      dueDate: periodDueDate,
      principalPayment: 0,
      interestPayment: graceInterest,
      totalPayment: graceInterest,
      remainingBalance: actualRemainingBalance,
      paidAmount: paidInPeriod,
      status:
        paidInPeriod >= graceInterest
          ? "PAID"
          : paidInPeriod > 0
            ? "PARTIAL"
            : "PENDING",
    });
    advanceDateByFrequency(rollingDate, scheduleFrequency);
  }

  // Normal Repayment
  for (let i = 1; i <= totalPeriods; i++) {
    const periodDueDate = new Date(rollingDate);

    const nextPeriodDate = new Date(periodDueDate);
    advanceDateByFrequency(nextPeriodDate, scheduleFrequency);

    let paidInPeriod = 0;
    while (
      paymentIndex < sortedPayments.length &&
      sortedPayments[paymentIndex].paymentDate < nextPeriodDate
    ) {
      paidInPeriod += sortedPayments[paymentIndex].amount;
      actualRemainingBalance -= sortedPayments[paymentIndex].principalPaid || 0;
      paymentIndex++;
    }

    schedule.push({
      period: currentPeriod++,
      dueDate: periodDueDate,
      principalPayment: principalPerPeriod,
      interestPayment: interestPerPeriod,
      totalPayment: totalPerPeriod,
      remainingBalance: Math.max(
        0,
        Math.round(actualRemainingBalance - principalPerPeriod),
      ),
      paidAmount: paidInPeriod,
      status:
        paidInPeriod >= totalPerPeriod - 0.9 // Allow 1 UGX difference for rounding
          ? "PAID"
          : paidInPeriod > 0
            ? "PARTIAL"
            : "PENDING",
    });
    actualRemainingBalance = Math.max(
      0,
      Math.round(
        actualRemainingBalance -
          Math.max(principalPerPeriod, paidInPeriod - interestPerPeriod),
      ),
    );
    if (i < totalPeriods)
      advanceDateByFrequency(rollingDate, scheduleFrequency);
  }

  const totalAmountRepaid = totalInterestAmount + principal;

  return {
    schedule,
    totalPrincipal: principal,
    totalInterest: totalInterestAmount,
    totalAmountRepaid,
  };
}

/**
 * Calculate loan schedule using Reducing Balance method
 */
export function calculateReducingBalanceSchedule(
  principal: number,
  monthlyRatePercent: number,
  periodMonths: number,
  gracePeriod: number = 0,
  startDate: Date = new Date(),
  payments: LoanPayment[] = [],
  scheduleFrequency: ScheduleFrequency = "MONTHLY",
): LoanCalculationResult {
  const frequencyInterval = frequencyToMonths(scheduleFrequency);
  const totalPeriods = calculatePeriodCount(periodMonths, scheduleFrequency);
  const gracePeriods =
    scheduleFrequency === "BI_WEEKLY"
      ? Math.round(gracePeriod * (30 / 14))
      : Math.max(0, Math.round(gracePeriod / frequencyInterval));

  const principalPerPeriod = principal / totalPeriods;
  const schedule: RepaymentScheduleItem[] = [];

  let theoreticalRemainingBalance = principal;
  let actualRemainingBalance = principal;
  let totalInterest = 0;
  let totalAmountRepaid = 0;
  let currentPeriod = 1;
  const rollingDate = new Date(startDate);

  const sortedPayments = [...payments].sort(
    (a, b) => a.paymentDate.getTime() - b.paymentDate.getTime(),
  );
  let paymentIndex = 0;

  // Grace Period: Interest Only
  for (let i = 0; i < gracePeriods; i++) {
    const periodDueDate = new Date(rollingDate);

    const nextPeriodDate = new Date(periodDueDate);
    advanceDateByFrequency(nextPeriodDate, scheduleFrequency);

    // Interest for reducing balance: rate applies per-period, adjusted for frequency
    const periodRatePercent = monthlyRatePercent * frequencyInterval;
    const interestPayment =
      theoreticalRemainingBalance * (periodRatePercent / 100);

    let paidInPeriod = 0;
    while (
      paymentIndex < sortedPayments.length &&
      sortedPayments[paymentIndex].paymentDate < nextPeriodDate
    ) {
      paidInPeriod += sortedPayments[paymentIndex].amount;
      actualRemainingBalance -= sortedPayments[paymentIndex].principalPaid || 0;
      paymentIndex++;
    }

    schedule.push({
      period: currentPeriod++,
      dueDate: periodDueDate,
      principalPayment: 0,
      interestPayment: interestPayment,
      totalPayment: interestPayment,
      remainingBalance: actualRemainingBalance,
      paidAmount: paidInPeriod,
      status:
        paidInPeriod >= interestPayment
          ? "PAID"
          : paidInPeriod > 0
            ? "PARTIAL"
            : "PENDING",
    });
    totalInterest += interestPayment;
    totalAmountRepaid += interestPayment;
    advanceDateByFrequency(rollingDate, scheduleFrequency);
  }

  // Normal Repayment
  for (let i = 1; i <= totalPeriods; i++) {
    const periodDueDate = new Date(rollingDate);

    const nextPeriodDate = new Date(periodDueDate);
    advanceDateByFrequency(nextPeriodDate, scheduleFrequency);

    const periodRatePercent = monthlyRatePercent * frequencyInterval;
    const interestPayment = Math.round(actualRemainingBalance * (periodRatePercent / 100));
    const totalPayment = principalPerPeriod + interestPayment;

    theoreticalRemainingBalance -= principalPerPeriod;

    let paidInPeriod = 0;
    while (
      paymentIndex < sortedPayments.length &&
      sortedPayments[paymentIndex].paymentDate < nextPeriodDate
    ) {
      paidInPeriod += sortedPayments[paymentIndex].amount;
      actualRemainingBalance -= sortedPayments[paymentIndex].principalPaid || 0;
      paymentIndex++;
    }

    const remainingAfterThis = Math.max(
      0,
      Math.round(actualRemainingBalance - principalPerPeriod),
    );

    schedule.push({
      period: currentPeriod++,
      dueDate: periodDueDate,
      principalPayment: principalPerPeriod,
      interestPayment: interestPayment,
      totalPayment: totalPayment,
      remainingBalance: remainingAfterThis,
      paidAmount: paidInPeriod,
      status:
        paidInPeriod >= totalPayment - 0.9 // Allow 1 UGX difference
          ? "PAID"
          : paidInPeriod > 0
            ? "PARTIAL"
            : "PENDING",
    });

    actualRemainingBalance = Math.max(
      0,
      Math.round(
        actualRemainingBalance -
          Math.max(principalPerPeriod, paidInPeriod - interestPayment),
      ),
    );

    totalInterest += interestPayment;
    totalAmountRepaid += totalPayment;
    if (i < totalPeriods)
      advanceDateByFrequency(rollingDate, scheduleFrequency);
  }

  return {
    schedule,
    totalPrincipal: principal,
    totalInterest,
    totalAmountRepaid,
  };
}

export function calculateLoanSchedule({
  amountGranted,
  interestRate,
  repaymentPeriodMonths,
  interestType,
  gracePeriod = 0,
  disbursementDate = new Date(),
  interestPeriod = "MONTHLY",
  payments = [],
  scheduleFrequency = "MONTHLY",
}: {
  amountGranted: number;
  interestRate: number;
  repaymentPeriodMonths: number;
  interestType: "FLAT_RATE" | "REDUCING_BALANCE";
  gracePeriod?: number;
  disbursementDate?: Date;
  interestPeriod?: "MONTHLY" | "ANNUAL";
  payments?: LoanPayment[];
  scheduleFrequency?: ScheduleFrequency;
}): LoanCalculationResult {
  const safeDisbursementDate =
    disbursementDate instanceof Date && !isNaN(disbursementDate.getTime())
      ? disbursementDate
      : new Date();

  const effectiveMonthlyRate =
    interestPeriod === "ANNUAL" ? interestRate / 12 : interestRate;

  const safeRepaymentPeriodMonths = Math.max(1, Math.min(600, Number(repaymentPeriodMonths) || 12));
  const safeAmountGranted = Math.max(0, Number(amountGranted) || 0);
  const safeInterestRate = Math.max(0, Number(interestRate) || 0);

  const gracePeriodMonths = Math.floor(gracePeriod / 30);

  if (interestType === "REDUCING_BALANCE") {
    return calculateReducingBalanceSchedule(
      safeAmountGranted,
      safeInterestRate,
      safeRepaymentPeriodMonths,
      gracePeriodMonths,
      safeDisbursementDate,
      payments,
      scheduleFrequency,
    );
  }
  return calculateFlatRateSchedule(
    safeAmountGranted,
    safeInterestRate,
    safeRepaymentPeriodMonths,
    gracePeriodMonths,
    safeDisbursementDate,
    payments,
    scheduleFrequency,
  );
}
