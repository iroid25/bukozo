import { db } from "./prisma/db";

async function checkSchedules() {
  try {
    const loanId = "cmmlo71z80001l504zz3jj0yf";
    console.log("Checking schedules for loanId:", loanId);
    
    // Check if the loan exists first
    const loan = await (db as any).institutionLoan.findUnique({
      where: { id: loanId }
    });
    
    console.log("Loan exists:", !!loan);
    if (!loan) {
        // Find any institutional loan to test with
        const anyLoan = await (db as any).institutionLoan.findFirst();
        console.log("Any institutional loan found:", anyLoan?.id);
    }

    const totalSchedules = await db.$queryRaw<any[]>`SELECT COUNT(*) as count FROM "InstitutionLoanRepaymentSchedule"`;
    console.log("Total Institution Schedules in DB:", Number(totalSchedules[0].count));

    const rawSchedules = await db.$queryRaw<any[]>`
      SELECT * FROM "InstitutionLoanRepaymentSchedule" 
      WHERE "loanId" = ${loanId} 
      ORDER BY "period" ASC
    `;
    
    console.log("Raw Schedules Count:", rawSchedules.length);
    if (rawSchedules.length > 0) {
      const item = rawSchedules[0];
      const getVal = (v: any, fallback: any = 0) => v === undefined || v === null ? fallback : v;
      
      const mapped = {
          principalDue: getVal(item.principalPayment || item.principalpayment || item.principal_payment),
          interestDue: getVal(item.interestPayment || item.interestpayment || item.interest_payment),
          totalDue: getVal(item.totalPayment || item.totalpayment || item.total_payment),
      };
      
      console.log("Sample Mapped Values:", mapped);
      console.log("Raw Item Keys:", Object.keys(item));
    }
    
  } catch (error) {
    console.error("Error checking schedules:", error);
  } finally {
    process.exit(0);
  }
}

checkSchedules();
