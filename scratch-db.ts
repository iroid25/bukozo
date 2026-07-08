import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    console.log("Testing deposits...");
    const result = await db.deposit.aggregate({
      where: { depositDate: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
      _count: { id: true }
    });
    console.log("Deposit success:", result);

    console.log("Testing loans sum...");
    const loanSum = await db.loan.aggregate({
      _sum: {
        amountGranted: true,
        outstandingBalance: true,
        amountPaid: true,
      }
    });
    console.log("LoanSum success:", loanSum);

    console.log("Testing loans counts...");
    const loanCount = await db.loan.count({
      where: {
        status: { in: ["DISBURSED", "OVERDUE"] },
      },
    });
    console.log("LoanCount success:", loanCount);
    
  } catch (error) {
    console.error("DB Error:", error);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
