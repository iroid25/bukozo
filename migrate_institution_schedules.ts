import { db } from "./prisma/db";
import { LoanService } from "./services/loan.service";

async function migrateSchedules() {
  try {
    console.log("Starting Institutional Loan Schedule Migration...");
    
    // Find all institutional loans that don't have schedules
    const institutionLoans = await (db as any).institutionLoan.findMany({
      include: {
        application: {
          include: {
            loanProduct: true
          }
        }
      }
    });

    console.log(`Found ${institutionLoans.length} institutional loans.`);

    for (const loan of institutionLoans) {
      // Check if schedules already exist
      const scheduleCount = await (db as any).institutionLoanRepaymentSchedule.count({
        where: { loanId: loan.id }
      });

      if (scheduleCount === 0) {
        console.log(`Generating schedules for loan ${loan.id}...`);
        
        // Use existing logic from LoanService to generate schedules
        // Since LoanService.disburseInstitution is private/complex, we can extract the logic or just implement it here
        const amount = loan.amountGranted;
        const interestRate = loan.interestRate;
        const months = loan.application.repaymentPeriodMonths || 12;
        const startDate = loan.disbursementDate || new Date();

        const monthlyInterestRate = interestRate / 12 / 100;
        const denominator = Math.pow(1 + monthlyInterestRate, -months);
        const monthlyPayment = (amount * monthlyInterestRate) / (1 - denominator);

        let remainingBalance = amount;
        const schedules = [];

        for (let i = 1; i <= months; i++) {
          const interestPayment = remainingBalance * monthlyInterestRate;
          const principalPayment = monthlyPayment - interestPayment;
          remainingBalance -= principalPayment;

          const dueDate = new Date(startDate);
          dueDate.setMonth(dueDate.getMonth() + i);

          schedules.push({
            loanId: loan.id,
            period: i,
            dueDate,
            principalPayment: Number(principalPayment.toFixed(2)),
            interestPayment: Number(interestPayment.toFixed(2)),
            totalPayment: Number(monthlyPayment.toFixed(2)),
            remainingBalance: Number(Math.max(0, remainingBalance).toFixed(2)),
            status: "PENDING",
            paidAmount: 0,
          });
        }

        // Save schedules via raw SQL to bypass stale client
        for (const s of schedules) {
          await db.$executeRaw`
            INSERT INTO "InstitutionLoanRepaymentSchedule" 
            ("id", "loanId", "period", "dueDate", "principalPayment", "interestPayment", "totalPayment", "remainingBalance", "status", "paidAmount", "createdAt", "updatedAt")
            VALUES 
            (${Math.random().toString(36).substring(7)}, ${s.loanId}, ${s.period}, ${s.dueDate}, ${s.principalPayment}, ${s.interestPayment}, ${s.totalPayment}, ${s.remainingBalance}, ${s.status}, ${s.paidAmount}, NOW(), NOW())
          `;
        }
        
        console.log(`Created ${schedules.length} schedules for loan ${loan.id}.`);

        // Also ensure an initial ledger transaction exists if missing
        const ledgerCount = await (db as any).institutionLoanLedgerTransaction.count({
          where: { loanId: loan.id }
        });

        if (ledgerCount === 0) {
           await db.$executeRaw`
            INSERT INTO "InstitutionLoanLedgerTransaction" 
            ("id", "loanId", "transactionDate", "transactionType", "voucherNo", "debitPrincipal", "debitInterest", "creditPrincipal", "creditInterest", "balancePrincipal", "balanceInterest", "balanceTotal", "createdAt", "updatedAt")
            VALUES 
            (${Math.random().toString(36).substring(7)}, ${loan.id}, ${startDate}, 'DISBURSEMENT', 'MIGRATE', ${amount}, 0, 0, 0, ${amount}, 0, ${amount}, NOW(), NOW())
          `;
          console.log(`Created initial ledger transaction for loan ${loan.id}.`);
        }
      } else {
        console.log(`Schedules already exist for loan ${loan.id}. Skipping.`);
      }
    }

    console.log("Migration completed successfully.");
    
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

migrateSchedules();
