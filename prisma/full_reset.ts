import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting Full Data Reset (Retaining Staff and Configuration)...");

  try {
    // 1. Delete Loan relate data (Member)
    console.log("🗑️  Deleting Member Loans...");
    await prisma.loanRepaymentSchedule.deleteMany();
    await prisma.loanRepayment.deleteMany();
    await prisma.loanRepaymentRequest.deleteMany();
    await prisma.loanWriteOff.deleteMany();
    await prisma.loanReschedule.deleteMany();
    await prisma.loanLedgerTransaction.deleteMany();
    await prisma.loanAppeal.deleteMany();
    await prisma.loan.deleteMany();
    await prisma.loanApplication.deleteMany();

    // 2. Delete Loan relate data (Institution)
    console.log("🗑️  Deleting Institution Loans...");
    await prisma.institutionLoanRepaymentSchedule.deleteMany();
    await prisma.institutionLoanRepayment.deleteMany();
    await prisma.institutionLoanLedgerTransaction.deleteMany();
    await prisma.institutionLoan.deleteMany();
    await prisma.institutionLoanApplication.deleteMany();

    // 3. Delete Transactions and Ledger Entries
    console.log("🗑️  Deleting Transactions and Ledger Entries...");
    await prisma.accountTransaction.deleteMany();
    await prisma.journalEntry.deleteMany();
    await prisma.deposit.deleteMany();
    await prisma.withdrawal.deleteMany();
    await prisma.withdrawalVerification.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.savingsTransaction.deleteMany();
    await prisma.shareTransaction.deleteMany();
    await prisma.vaultTransaction.deleteMany();
    await prisma.vaultReconciliation.deleteMany();
    await prisma.floatTransaction.deleteMany();
    await prisma.floatAllocation.deleteMany();
    await prisma.floatReconciliation.deleteMany();
    await prisma.insuranceContribution.deleteMany();
    await prisma.expenditureRecord.deleteMany();
    await prisma.incomeRecord.deleteMany();

    // 4. Delete Logs and Communications
    console.log("🗑️  Deleting Logs and Notifications...");
    await prisma.auditLog.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.customerFeedback.deleteMany();
    await prisma.smsLog.deleteMany();
    await prisma.statementEmailLog.deleteMany();
    await prisma.statement.deleteMany();

    // 5. Delete Orders and Schedules
    console.log("🗑️  Deleting Standing Orders...");
    await prisma.standingOrderExecution.deleteMany();
    await prisma.standingOrder.deleteMany();

    // 6. Delete Accounts and Holds
    console.log("🗑️  Deleting Accounts and Holds...");
    await prisma.accountHold.deleteMany();
    await prisma.savingsAccount.deleteMany();
    await prisma.shareAccount.deleteMany();
    await prisma.fixedDeposit.deleteMany();
    await prisma.account.deleteMany();

    // 7. Delete Organizations and Signatories
    console.log("🗑️  Deleting Institutions...");
    await prisma.institutionSignatory.deleteMany();
    await prisma.institutionWithdrawal.deleteMany();
    await prisma.institution.deleteMany();

    // 8. Delete People (Members and Member-role Users)
    console.log("🗑️  Deleting Members and Member Users...");
    await prisma.member.deleteMany();
    
    // We only delete users with the role of MEMBER
    const deleteUsers = await prisma.user.deleteMany({
      where: {
        role: "MEMBER"
      }
    });
    console.log(`✅ Deleted ${deleteUsers.count} member users.`);

    // 9. Reset Chart of Account Balances
    console.log("⚖️  Resetting Chart of Account balances to zero...");
    await prisma.chartOfAccount.updateMany({
      data: {
        balance: 0,
        debitBalance: 0,
        creditBalance: 0
      }
    });

    // 10. Clear Sessions
    console.log("🔑 Clearing all sessions...");
    await prisma.session.deleteMany();

    console.log("\n✨ Database reset successfully!");
    console.log("Staff members, Branches, Account Types, and Loan Products have been preserved.");

  } catch (error) {
    console.error("❌ Error during reset:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
