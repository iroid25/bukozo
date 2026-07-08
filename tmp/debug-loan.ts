import { db } from "./prisma/db";

async function main() {
  const loanId = "cmmbwnm6i0001jl04t1ojf45q";
  console.log(`Checking loan: ${loanId}`);
  
  const loan = await db.loan.findUnique({
    where: { id: loanId },
    include: {
      schedules: true,
      member: { include: { user: true } }
    }
  });

  if (!loan) {
    console.log("Loan NOT found");
    return;
  }

  console.log("Loan found:", {
    id: loan.id,
    status: loan.status,
    scheduleCount: loan.schedules.length
  });

  if (loan.schedules.length > 0) {
    console.log("Sample schedule:", loan.schedules[0]);
  } else {
    console.log("NO SCHEDULES FOUND for this loan.");
  }
}

main().catch(console.error);
