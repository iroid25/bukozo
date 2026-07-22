import { db } from "../prisma/db.ts";

async function main() {
  const loan = await db.institutionLoan.findUnique({
    where: { id: "cmrp2g5bc0021qw015mfjck89" },
    include: {
      institution: { select: { institutionName: true } },
      application: { select: { amountApplied: true, approvedAmount: true, repaymentPeriodMonths: true, gracePeriod: true, interestType: true, interestPeriod: true } },
      repayments: { select: { amount: true, principalPaid: true, interestPaid: true, repaymentDate: true } },
      schedules: { orderBy: { period: "asc" }, select: { period: true, dueDate: true, principalPayment: true, interestPayment: true, totalPayment: true, remainingBalance: true, status: true, paidAmount: true } },
    },
  });

  if (!loan) { console.log("not found"); return; }

  console.log("=== Institution Loan ===");
  console.log("Institution:", loan.institution.institutionName);
  console.log("amountGranted:", loan.amountGranted);
  console.log("interestRate:", loan.interestRate);
  console.log("totalAmountDue:", loan.totalAmountDue);
  console.log("amountPaid:", loan.amountPaid);
  console.log("outstandingBalance:", loan.outstandingBalance);
  console.log("principalPaid:", loan.principalPaid, "interestPaid:", loan.interestPaid, "penaltyPaid:", loan.penaltyPaid, "penaltyCharged:", loan.penaltyCharged);
  console.log("disbursementDate:", loan.disbursementDate);
  console.log("dueDate:", loan.dueDate);
  console.log("status:", loan.status);
  console.log("\napplication:", loan.application);

  console.log("\nrepayments count:", loan.repayments.length);
  const totalRepaid = loan.repayments.reduce((s, r) => s + r.amount, 0);
  console.log("sum(repayments.amount):", totalRepaid);

  console.log("\nschedules count:", loan.schedules.length);
  const scheduleTotal = loan.schedules.reduce((s, sc) => s + sc.totalPayment, 0);
  const schedulePrincipal = loan.schedules.reduce((s, sc) => s + sc.principalPayment, 0);
  const scheduleInterest = loan.schedules.reduce((s, sc) => s + sc.interestPayment, 0);
  console.log("sum(schedule.totalPayment):", scheduleTotal);
  console.log("sum(schedule.principalPayment):", schedulePrincipal, "(should ~= amountGranted:", loan.amountGranted, ")");
  console.log("sum(schedule.interestPayment):", scheduleInterest);
  console.log("first schedule dueDate:", loan.schedules[0]?.dueDate, "last:", loan.schedules[loan.schedules.length-1]?.dueDate);
  console.log("expected totalAmountDue (granted + interest):", loan.amountGranted + scheduleInterest);
  console.log("actual totalAmountDue field:", loan.totalAmountDue);
  console.log("diff:", loan.totalAmountDue - (loan.amountGranted + scheduleInterest));

  const outstandingFromSchedules = loan.schedules.reduce((s, sc) => s + (sc.totalPayment - sc.paidAmount), 0);
  console.log("\noutstanding computed from schedules (totalPayment-paidAmount):", outstandingFromSchedules);
  console.log("outstandingBalance field:", loan.outstandingBalance);
  console.log("diff:", loan.outstandingBalance - outstandingFromSchedules);
}

main().then(() => db.$disconnect()).catch(async e => { console.error(e); await db.$disconnect(); process.exit(1); });
