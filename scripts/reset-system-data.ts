/**
 * SYSTEM DATA RESET SCRIPT
 * ========================
 * Deletes all member, transaction, and loan data while preserving:
 * - Staff Users (ADMIN, BRANCHMANAGER, TELLER, AGENT, ACCOUNTANT, LOANOFFICER, AUDITOR, DATA_ENTRANT, ACCOUNT_OPENER)
 * - Branches
 * - Account Types
 * - Loan Products
 * - Chart of Accounts (structure preserved, balances reset to 0)
 * - Budget Categories, Income Categories, Expenditure Categories
 * - Financial Periods
 * - Fee Configurations (GlobalFeeConfiguration, StaffLimit)
 * - Vaults (structure preserved, balances reset to 0)
 * - Fixed Assets & related depreciation/maintenance
 * - System Configuration
 * - API Keys
 * - Account Number Sequences
 *
 * USAGE:
 *   npx tsx scripts/reset-system-data.ts            # Dry run (count only)
 *   npx tsx scripts/reset-system-data.ts --execute   # Actually delete
 */

import { PrismaClient } from "@prisma/client";
import * as readline from "readline";

const prisma = new PrismaClient();

const isDryRun = !process.argv.includes("--execute");

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function countAll() {
  console.log("\n📊 Current record counts:\n");

  const counts: Record<string, number> = {};

  // Members & Institutions
  counts["User (MEMBER/INSTITUTION)"] = await prisma.user.count({
    where: { role: { in: ["MEMBER", "INSTITUTION"] } },
  });
  counts["User (Staff - KEPT)"] = await prisma.user.count({
    where: { role: { notIn: ["MEMBER", "INSTITUTION"] } },
  });
  counts["Member"] = await prisma.member.count();
  counts["Institution"] = await prisma.institution.count();
  counts["InstitutionSignatory"] = await prisma.institutionSignatory.count();

  // Accounts
  counts["Account"] = await prisma.account.count();
  counts["SavingsAccount"] = await prisma.savingsAccount.count();
  counts["ShareAccount"] = await prisma.shareAccount.count();
  counts["FixedDeposit"] = await prisma.fixedDeposit.count();
  counts["AccountHold"] = await prisma.accountHold.count();

  // Transactions
  counts["Transaction"] = await prisma.transaction.count();
  counts["Deposit"] = await prisma.deposit.count();
  counts["Withdrawal"] = await prisma.withdrawal.count();
  counts["WithdrawalVerification"] = await prisma.withdrawalVerification.count();
  counts["AccountTransaction"] = await prisma.accountTransaction.count();
  counts["JournalEntry"] = await prisma.journalEntry.count();
  counts["SavingsTransaction"] = await prisma.savingsTransaction.count();
  counts["ShareTransaction"] = await prisma.shareTransaction.count();

  // Loans (Individual)
  counts["LoanApplication"] = await prisma.loanApplication.count();
  counts["Loan"] = await prisma.loan.count();
  counts["LoanRepayment"] = await prisma.loanRepayment.count();
  counts["LoanRepaymentSchedule"] = await prisma.loanRepaymentSchedule.count();
  counts["LoanRepaymentRequest"] = await prisma.loanRepaymentRequest.count();
  counts["LoanReschedule"] = await prisma.loanReschedule.count();
  counts["LoanWriteOff"] = await prisma.loanWriteOff.count();
  counts["LoanAppeal"] = await prisma.loanAppeal.count();
  counts["LoanLedgerTransaction"] = await prisma.loanLedgerTransaction.count();

  // Loans (Institution)
  counts["InstitutionLoanApplication"] = await prisma.institutionLoanApplication.count();
  counts["InstitutionLoan"] = await prisma.institutionLoan.count();
  counts["InstitutionLoanRepayment"] = await prisma.institutionLoanRepayment.count();
  counts["InstitutionLoanRepaymentSchedule"] = await prisma.institutionLoanRepaymentSchedule.count();
  counts["InstitutionLoanLedgerTransaction"] = await prisma.institutionLoanLedgerTransaction.count();
  counts["InstitutionWithdrawal"] = await prisma.institutionWithdrawal.count();

  // Float & Vault Operations
  counts["UserFloat"] = await prisma.userFloat.count();
  counts["FloatTransaction"] = await prisma.floatTransaction.count();
  counts["FloatAllocation"] = await prisma.floatAllocation.count();
  counts["FloatReconciliation"] = await prisma.floatReconciliation.count();
  counts["VaultTransaction"] = await prisma.vaultTransaction.count();
  counts["VaultReconciliation"] = await prisma.vaultReconciliation.count();
  counts["BranchReserveAllocation"] = await prisma.branchReserveAllocation.count();

  // Insurance
  counts["InsuranceContribution"] = await prisma.insuranceContribution.count();

  // Standing Orders
  counts["StandingOrderExecution"] = await prisma.standingOrderExecution.count();
  counts["StandingOrder"] = await prisma.standingOrder.count();

  // Statements
  counts["StatementEmailLog"] = await prisma.statementEmailLog.count();
  counts["Statement"] = await prisma.statement.count();

  // Suspense
  counts["SuspenseTransaction"] = await prisma.suspenseTransaction.count();
  counts["SuspenseAccount"] = await prisma.suspenseAccount.count();

  // Operations
  counts["TransactionBatch"] = await prisma.transactionBatch.count();
  counts["TransactionSession"] = await prisma.transactionSession.count();
  counts["CashShortage"] = await prisma.cashShortage.count();

  // Communication & Logs
  counts["Notification"] = await prisma.notification.count();
  counts["SmsLog"] = await prisma.smsLog.count();
  counts["CustomerFeedback"] = await prisma.customerFeedback.count();
  counts["AuditLog"] = await prisma.auditLog.count();

  // Income/Expense Records
  counts["IncomeRecord"] = await prisma.incomeRecord.count();
  counts["ExpenditureRecord"] = await prisma.expenditureRecord.count();

  // Settings (KEPT)
  const keptCounts: Record<string, number> = {};
  keptCounts["Branch"] = await prisma.branch.count();
  keptCounts["AccountType"] = await prisma.accountType.count();
  keptCounts["LoanProduct"] = await prisma.loanProduct.count();
  keptCounts["ChartOfAccount"] = await prisma.chartOfAccount.count();
  keptCounts["Vault"] = await prisma.vault.count();
  keptCounts["BudgetCategory"] = await prisma.budgetCategory.count();
  keptCounts["IncomeCategory"] = await prisma.incomeCategory.count();
  keptCounts["ExpenditureCategory"] = await prisma.expenditureCategory.count();
  keptCounts["FixedAsset"] = await prisma.fixedAsset.count();
  keptCounts["SystemConfiguration"] = await prisma.systemConfiguration.count();
  keptCounts["GlobalFeeConfiguration"] = await prisma.globalFeeConfiguration.count();

  console.log("  🗑️  TO BE DELETED:");
  let totalDelete = 0;
  for (const [table, count] of Object.entries(counts)) {
    if (table.includes("KEPT")) {
      console.log(`     ✅ ${table}: ${count}`);
    } else {
      console.log(`     ❌ ${table}: ${count}`);
      totalDelete += count;
    }
  }
  console.log(`\n     📊 Total records to delete: ${totalDelete}\n`);

  console.log("  ✅ PRESERVED (Settings):");
  for (const [table, count] of Object.entries(keptCounts)) {
    console.log(`     ✅ ${table}: ${count}`);
  }

  return totalDelete;
}

async function executeReset() {
  console.log("\n🚀 Starting data reset...\n");
  const results: Record<string, number> = {};

  // ═══════════════════════════════════════════
  // PHASE 1: Leaf tables (no dependents)
  // ═══════════════════════════════════════════
  console.log("  Phase 1: Deleting leaf tables...");

  results["StatementEmailLog"] = (await prisma.statementEmailLog.deleteMany()).count;
  results["StandingOrderExecution"] = (await prisma.standingOrderExecution.deleteMany()).count;
  results["SmsLog"] = (await prisma.smsLog.deleteMany()).count;
  results["CustomerFeedback"] = (await prisma.customerFeedback.deleteMany()).count;
  results["CashShortage"] = (await prisma.cashShortage.deleteMany()).count;
  results["Notification"] = (await prisma.notification.deleteMany()).count;
  results["AuditLog"] = (await prisma.auditLog.deleteMany()).count;
  results["SavingsTransaction"] = (await prisma.savingsTransaction.deleteMany()).count;
  results["ShareTransaction"] = (await prisma.shareTransaction.deleteMany()).count;
  results["AccountTransaction"] = (await prisma.accountTransaction.deleteMany()).count;
  results["JournalEntry"] = (await prisma.journalEntry.deleteMany()).count;
  results["FloatTransaction"] = (await prisma.floatTransaction.deleteMany()).count;
  results["FloatAllocation"] = (await prisma.floatAllocation.deleteMany()).count;
  results["FloatReconciliation"] = (await prisma.floatReconciliation.deleteMany()).count;
  results["VaultTransaction"] = (await prisma.vaultTransaction.deleteMany()).count;
  results["VaultReconciliation"] = (await prisma.vaultReconciliation.deleteMany()).count;
  results["BranchReserveAllocation"] = (await prisma.branchReserveAllocation.deleteMany()).count;
  results["SuspenseTransaction"] = (await prisma.suspenseTransaction.deleteMany()).count;
  results["TransactionBatch"] = (await prisma.transactionBatch.deleteMany()).count;
  results["TransactionSession"] = (await prisma.transactionSession.deleteMany()).count;
  results["InsuranceContribution"] = (await prisma.insuranceContribution.deleteMany()).count;
  results["AccountHold"] = (await prisma.accountHold.deleteMany()).count;
  results["LoanLedgerTransaction"] = (await prisma.loanLedgerTransaction.deleteMany()).count;
  results["InstitutionLoanLedgerTransaction"] = (await prisma.institutionLoanLedgerTransaction.deleteMany()).count;
  results["LoanRepaymentSchedule"] = (await prisma.loanRepaymentSchedule.deleteMany()).count;
  results["InstitutionLoanRepaymentSchedule"] = (await prisma.institutionLoanRepaymentSchedule.deleteMany()).count;

  console.log("  ✅ Phase 1 complete\n");

  // ═══════════════════════════════════════════
  // PHASE 2: Mid-level tables
  // ═══════════════════════════════════════════
  console.log("  Phase 2: Deleting mid-level tables...");

  results["LoanRepayment"] = (await prisma.loanRepayment.deleteMany()).count;
  results["InstitutionLoanRepayment"] = (await prisma.institutionLoanRepayment.deleteMany()).count;
  results["LoanRepaymentRequest"] = (await prisma.loanRepaymentRequest.deleteMany()).count;
  results["LoanReschedule"] = (await prisma.loanReschedule.deleteMany()).count;
  results["LoanWriteOff"] = (await prisma.loanWriteOff.deleteMany()).count;
  results["LoanAppeal"] = (await prisma.loanAppeal.deleteMany()).count;
  results["StandingOrder"] = (await prisma.standingOrder.deleteMany()).count;
  results["Statement"] = (await prisma.statement.deleteMany()).count;
  results["InstitutionWithdrawal"] = (await prisma.institutionWithdrawal.deleteMany()).count;
  results["WithdrawalVerification"] = (await prisma.withdrawalVerification.deleteMany()).count;
  results["Deposit"] = (await prisma.deposit.deleteMany()).count;
  results["Withdrawal"] = (await prisma.withdrawal.deleteMany()).count;
  results["IncomeRecord"] = (await prisma.incomeRecord.deleteMany()).count;
  results["ExpenditureRecord"] = (await prisma.expenditureRecord.deleteMany()).count;

  console.log("  ✅ Phase 2 complete\n");

  // ═══════════════════════════════════════════
  // PHASE 3: Core entity tables
  // ═══════════════════════════════════════════
  console.log("  Phase 3: Deleting core entities...");

  results["Transaction"] = (await prisma.transaction.deleteMany()).count;
  results["Loan"] = (await prisma.loan.deleteMany()).count;
  results["LoanApplication"] = (await prisma.loanApplication.deleteMany()).count;
  results["InstitutionLoan"] = (await prisma.institutionLoan.deleteMany()).count;
  results["InstitutionLoanApplication"] = (await prisma.institutionLoanApplication.deleteMany()).count;
  results["SavingsAccount"] = (await prisma.savingsAccount.deleteMany()).count;
  results["ShareAccount"] = (await prisma.shareAccount.deleteMany()).count;
  results["FixedDeposit"] = (await prisma.fixedDeposit.deleteMany()).count;
  results["Account"] = (await prisma.account.deleteMany()).count;
  results["SuspenseAccount"] = (await prisma.suspenseAccount.deleteMany()).count;

  console.log("  ✅ Phase 3 complete\n");

  // ═══════════════════════════════════════════
  // PHASE 4: People (Members, Institutions, Member Users)
  // ═══════════════════════════════════════════
  console.log("  Phase 4: Deleting members, institutions, and member users...");

  results["InstitutionSignatory"] = (await prisma.institutionSignatory.deleteMany()).count;
  results["Institution"] = (await prisma.institution.deleteMany()).count;
  results["Member"] = (await prisma.member.deleteMany()).count;
  results["UserFloat"] = (await prisma.userFloat.deleteMany()).count;

  // Delete User records for MEMBER and INSTITUTION roles
  // Staff users (ADMIN, TELLER, AGENT, etc.) are preserved
  results["User (MEMBER)"] = (await prisma.user.deleteMany({
    where: { role: "MEMBER" },
  })).count;
  results["User (INSTITUTION)"] = (await prisma.user.deleteMany({
    where: { role: "INSTITUTION" },
  })).count;

  // Also delete any orphaned sessions for deleted users
  results["Session (orphaned)"] = (await prisma.session.deleteMany({
    where: {
      user: { is: undefined as any },
    },
  })).count;

  console.log("  ✅ Phase 4 complete\n");

  // ═══════════════════════════════════════════
  // PHASE 5: Reset balances (preserve structure)
  // ═══════════════════════════════════════════
  console.log("  Phase 5: Resetting GL and Vault balances...");

  const glReset = await prisma.chartOfAccount.updateMany({
    data: {
      balance: 0,
      debitBalance: 0,
      creditBalance: 0,
    },
  });
  console.log(`     GL Accounts reset: ${glReset.count}`);

  const vaultReset = await prisma.vault.updateMany({
    data: {
      balance: 0,
      physicalCash: 0,
      lastVerified: null,
    },
  });
  console.log(`     Vaults reset: ${vaultReset.count}`);

  console.log("  ✅ Phase 5 complete\n");

  // ═══════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════
  console.log("═══════════════════════════════════════════");
  console.log("  ✅ RESET COMPLETE — Summary:");
  console.log("═══════════════════════════════════════════\n");

  let totalDeleted = 0;
  for (const [table, count] of Object.entries(results)) {
    if (count > 0) {
      console.log(`     🗑️  ${table}: ${count} deleted`);
    }
    totalDeleted += count;
  }
  console.log(`\n     📊 Total records deleted: ${totalDeleted}`);
  console.log(`     📊 GL Accounts reset to 0: ${glReset.count}`);
  console.log(`     📊 Vaults reset to 0: ${vaultReset.count}`);
  console.log("\n  ✅ Settings, branches, account types, loan products,");
  console.log("     chart of accounts, and staff users are PRESERVED.\n");
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   BUKONZO EMERGENCY SACCO — SYSTEM RESET    ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log("║  This will DELETE all member, transaction,   ║");
  console.log("║  and loan data. Settings are PRESERVED.      ║");
  console.log("╚══════════════════════════════════════════════╝");

  try {
    const totalToDelete = await countAll();

    if (isDryRun) {
      console.log("\n  ⚠️  DRY RUN MODE — No data was deleted.");
      console.log("  To execute the reset, run:");
      console.log("  npx tsx scripts/reset-system-data.ts --execute\n");
      return;
    }

    if (totalToDelete === 0) {
      console.log("\n  ✅ Database is already clean. Nothing to delete.\n");
      return;
    }

    console.log("\n  ⚠️  WARNING: This action CANNOT be undone!");
    console.log("  Make sure you have a database backup before proceeding.\n");

    const answer = await prompt('  Type "CONFIRM RESET" to proceed: ');
    if (answer !== "CONFIRM RESET") {
      console.log("\n  ❌ Reset cancelled. No data was deleted.\n");
      return;
    }

    await executeReset();
  } catch (error) {
    console.error("\n  ❌ Error during reset:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
