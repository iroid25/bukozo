const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("=== Check Loan Data for Dues vs Repayment Report ===\n");

  // 1. Check disbursed loans
  const loans = await prisma.loan.findMany({
    where: { status: "DISBURSED" },
    select: { id: true, amountGranted: true, status: true, memberId: true },
    take: 5,
  });
  console.log("Disbursed Loans (sample):", loans.length);

  // 2. Check schedules
  const schedules = await prisma.loanRepaymentSchedule.findMany({
    select: {
      id: true,
      loanId: true,
      dueDate: true,
      principalPayment: true,
      interestPayment: true,
      totalPayment: true,
      status: true,
    },
    take: 10,
  });
  console.log("\nLoan Repayment Schedules (sample):", schedules.length);
  if (schedules.length > 0) {
    console.log("Sample:", JSON.stringify(schedules[0], null, 2));
  }

  // 3. Check repayments
  const repayments = await prisma.loanRepayment.findMany({
    select: {
      id: true,
      loanId: true,
      amount: true,
      principalPaid: true,
      interestPaid: true,
      repaymentDate: true,
    },
    take: 10,
  });
  console.log("\nLoan Repayments (sample):", repayments.length);
  if (repayments.length > 0) {
    console.log("Sample:", JSON.stringify(repayments[0], null, 2));
  }

  // 4. Check loan status summary
  const statusCounts = await prisma.loan.groupBy({
    by: ["status"],
    _count: true,
  });
  console.log("\nLoan Status Counts:", statusCounts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
