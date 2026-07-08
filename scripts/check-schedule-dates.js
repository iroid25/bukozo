const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("=== Check Schedule Dates and Filter Behavior ===\n");

  // Get date range of schedules
  const dateRange = await prisma.loanRepaymentSchedule.aggregate({
    _min: { dueDate: true },
    _max: { dueDate: true },
  });
  console.log("Schedule Date Range:", dateRange);

  // Get date range of repayments
  const repDateRange = await prisma.loanRepayment.aggregate({
    _min: { repaymentDate: true },
    _max: { repaymentDate: true },
  });
  console.log("Repayment Date Range:", repDateRange);

  // Count schedules by status
  const scheduleStatusCounts = await prisma.loanRepaymentSchedule.groupBy({
    by: ["status"],
    _count: true,
  });
  console.log("Schedule Status Counts:", scheduleStatusCounts);

  // Check for schedules with no due date
  const noDueDate = await prisma.loanRepaymentSchedule.count({
    where: { dueDate: null },
  });
  console.log("Schedules with no dueDate:", noDueDate);

  // Check actual data structure
  const sampleSchedule = await prisma.loanRepaymentSchedule.findFirst({
    include: {
      loan: {
        include: {
          member: { include: { user: true } },
          loanApplication: { include: { loanProduct: true } },
        },
      },
    },
  });
  console.log(
    "\nSample Schedule with relations:",
    JSON.stringify(
      {
        id: sampleSchedule.id,
        dueDate: sampleSchedule.dueDate,
        principalPayment: sampleSchedule.principalPayment,
        interestPayment: sampleSchedule.interestPayment,
        totalPayment: sampleSchedule.totalPayment,
        status: sampleSchedule.status,
        loanId: sampleSchedule.loanId,
        memberName: sampleSchedule.loan?.member?.user?.name,
        loanProduct: sampleSchedule.loan?.loanApplication?.loanProduct?.name,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
