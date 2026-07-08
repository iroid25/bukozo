import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function resetLoansAndTransactions() {
  console.log("Starting loan and transaction reset...");

  try {
    // Delete in correct order due to foreign key constraints
    console.log("Deleting loan ledger transactions...");
    await db.loanLedgerTransaction.deleteMany({});

    console.log("Deleting loan repayments...");
    await db.loanRepayment.deleteMany({});

    console.log("Deleting loan repayment schedules...");
    await db.loanRepaymentSchedule.deleteMany({});

    console.log("Deleting loan repayment requests...");
    await db.loanRepaymentRequest.deleteMany({});

    console.log("Deleting insurance contributions linked to loan applications...");
    await db.insuranceContribution.deleteMany({});

    console.log("Deleting loan reschedules...");
    await db.loanReschedule.deleteMany({});

    console.log("Deleting loan writeoffs...");
    await db.loanWriteOff.deleteMany({});

    console.log("Deleting loan appeals...");
    await db.loanAppeal.deleteMany({});

    console.log("Deleting loans...");
    await db.loan.deleteMany({});

    // Institution loans
    console.log("Deleting institution loan ledger transactions...");
    await db.$executeRaw`DELETE FROM "InstitutionLoanLedgerTransaction"`;

    console.log("Deleting institution loan repayment schedules...");
    await db.$executeRaw`DELETE FROM "InstitutionLoanRepaymentSchedule"`;

    console.log("Deleting institution loan repayments...");
    await db.institutionLoanRepayment.deleteMany({});

    console.log("Deleting institution loans...");
    await db.institutionLoan.deleteMany({});

    // Also delete loan applications
    console.log("Deleting loan applications...");
    await db.loanApplication.deleteMany({});
    await db.institutionLoanApplication.deleteMany({});

    console.log(
      "✅ Reset complete! All loans, transactions, and applications deleted.",
    );
  } catch (error) {
    console.error("Error during reset:", error);
  } finally {
    await db.$disconnect();
  }
}

resetLoansAndTransactions();
