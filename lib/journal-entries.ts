import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";
import { db } from "@/prisma/db";
import {
  findActiveAccountByCodes,
  getAccountCodeCandidates,
} from "@/lib/accounting/coa-identity";

/**
 * Creates automatic journal entry for income transactions
 * Dr: Cash Account (+)
 * Cr: Income Account (+)
 */
export async function createIncomeJournalEntry(data: {
  amount: number;
  description: string;
  reference?: string;
  transactionId?: string;
  userId: string;
  entryDate?: Date;
  branchId?: string;
}) {
  // Find required accounts
  const [incomeAccount, cashAccount] = await Promise.all([
    db.chartOfAccount.findFirst({
      where: { ledgerType: "INCOME", isActive: true },
    }),
    findActiveAccountByCodes(db, ["102001"]),
  ]);

  if (!incomeAccount || !cashAccount) {
    throw new Error("Chart of Accounts not configured for income entries");
  }

  const entryNumber = `JE-INC-${Date.now()}`;

  // Create journal entries and update balances atomically
  await db.$transaction([
    // Debit: Cash (Asset increases)
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: cashAccount.id,
        debitAmount: data.amount,
        creditAmount: 0,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    // Credit: Income (Income increases)
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: incomeAccount.id,
        debitAmount: 0,
        creditAmount: data.amount,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    // Update Cash balance
    db.chartOfAccount.update({
      where: { id: cashAccount.id },
      data: buildAccountBalanceUpdate(cashAccount, { debitAmount: data.amount }),
    }),
    // Update Income balance
    db.chartOfAccount.update({
      where: { id: incomeAccount.id },
      data: buildAccountBalanceUpdate(incomeAccount, { creditAmount: data.amount }),
    }),
  ]);

  return { success: true, entryNumber };
}

/**
 * Creates automatic journal entry for expenditure transactions
 * Dr: Expense Account (+)
 * Cr: Cash Account (-)
 */
export async function createExpenditureJournalEntry(data: {
  amount: number;
  description: string;
  reference?: string;
  transactionId?: string;
  userId: string;
  entryDate?: Date;
  branchId?: string;
}) {
  // Find required accounts
  const [expenseAccount, cashAccount] = await Promise.all([
    db.chartOfAccount.findFirst({
      where: { ledgerType: "EXPENDITURES", isActive: true },
    }),
    findActiveAccountByCodes(db, ["102001"]),
  ]);

  if (!expenseAccount || !cashAccount) {
    throw new Error("Chart of Accounts not configured for expenditure entries");
  }

  const entryNumber = `JE-EXP-${Date.now()}`;

  // Create journal entries and update balances atomically
  await db.$transaction([
    // Debit: Expense (Expense increases)
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: expenseAccount.id,
        debitAmount: data.amount,
        creditAmount: 0,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    // Credit: Cash (Asset decreases)
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: cashAccount.id,
        debitAmount: 0,
        creditAmount: data.amount,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    // Update Expense balance
    db.chartOfAccount.update({
      where: { id: expenseAccount.id },
      data: buildAccountBalanceUpdate(expenseAccount, { debitAmount: data.amount }),
    }),
    // Update Cash balance
    db.chartOfAccount.update({
      where: { id: cashAccount.id },
      data: buildAccountBalanceUpdate(cashAccount, { creditAmount: data.amount }),
    }),
  ]);

  return { success: true, entryNumber };
}

/**
 * Creates automatic journal entry for loan disbursement
 * Dr: Loan Receivable (+)
 * Cr: Cash Account (-)
 */
export async function createLoanDisbursementJournalEntry(data: {
  amount: number;
  description: string;
  reference?: string;
  transactionId?: string;
  userId: string;
  loanAccountId?: string;
  cashAccountId?: string;
  entryDate?: Date;
  branchId?: string;
}) {
  const [loanAccount, cashAccount] = await Promise.all([
    findActiveAccountByCodes(db, getAccountCodeCandidates("107000")),
    findActiveAccountByCodes(db, ["102001"]),
  ]);

  if (!loanAccount || !cashAccount) {
    throw new Error("Chart of Accounts not configured for loan entries");
  }

  const entryNumber = `JE-LOAN-${Date.now()}`;

  await db.$transaction([
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: loanAccount.id,
        debitAmount: data.amount,
        creditAmount: 0,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: cashAccount.id,
        debitAmount: 0,
        creditAmount: data.amount,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    db.chartOfAccount.update({
      where: { id: loanAccount.id },
      data: buildAccountBalanceUpdate(loanAccount, { debitAmount: data.amount }),
    }),
    db.chartOfAccount.update({
      where: { id: cashAccount.id },
      data: buildAccountBalanceUpdate(cashAccount, { creditAmount: data.amount }),
    }),
  ]);

  return { success: true, entryNumber };
}

/**
 * Creates automatic journal entry for loan repayment
 * Dr: Cash Account (+)
 * Cr: Loan Receivable (-)
 */
export async function createLoanRepaymentJournalEntry(data: {
  amount: number;
  description: string;
  reference?: string;
  transactionId?: string;
  userId: string;
  loanAccountId?: string;
  cashAccountId?: string;
  entryDate?: Date;
  branchId?: string;
}) {
  const [loanAccount, cashAccount] = await Promise.all([
    findActiveAccountByCodes(db, getAccountCodeCandidates("107000")),
    findActiveAccountByCodes(db, ["102001"]),
  ]);

  if (!loanAccount || !cashAccount) {
    throw new Error("Chart of Accounts not configured for loan repayment entries");
  }

  const entryNumber = `JE-REPAY-${Date.now()}`;

  await db.$transaction([
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: cashAccount.id,
        debitAmount: data.amount,
        creditAmount: 0,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: loanAccount.id,
        debitAmount: 0,
        creditAmount: data.amount,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    db.chartOfAccount.update({
      where: { id: cashAccount.id },
      data: buildAccountBalanceUpdate(cashAccount, { debitAmount: data.amount }),
    }),
    db.chartOfAccount.update({
      where: { id: loanAccount.id },
      data: buildAccountBalanceUpdate(loanAccount, { creditAmount: data.amount }),
    }),
  ]);

  return { success: true, entryNumber };
}

/**
 * Creates automatic journal entry for loan penalty accrual
 * Dr: Loan Receivable (+) - Asset increases
 * Cr: Penalty Income (+) - Income increases
 */
export async function createLoanPenaltyAccrualJournalEntry(data: {
  amount: number;
  description: string;
  reference?: string;
  transactionId?: string;
  userId: string;
  loanAccountId?: string;
  penaltyAccountId?: string;
  entryDate?: Date;
  branchId?: string;
}, tx: any = db) {
  const [loanAccount, penaltyAccount] = await Promise.all([
    data.loanAccountId 
      ? tx.chartOfAccount.findUnique({ where: { id: data.loanAccountId, isActive: true } })
      : findActiveAccountByCodes(tx, getAccountCodeCandidates("107000")),
    data.penaltyAccountId
      ? tx.chartOfAccount.findUnique({ where: { id: data.penaltyAccountId, isActive: true } })
      : findActiveAccountByCodes(tx, getAccountCodeCandidates("401005")),
  ]);

  if (!loanAccount || !penaltyAccount) {
    throw new Error("Chart of Accounts not configured for loan penalty entries");
  }

  const entryNumber = `JE-PENALTY-${Date.now()}`;
  const isTransaction = (tx as any).$transaction === undefined;

  const operations = async (client: any) => {
    await client.journalEntry.create({
      data: {
        entryNumber,
        accountId: loanAccount.id,
        debitAmount: data.amount,
        creditAmount: 0,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    });

    await client.journalEntry.create({
      data: {
        entryNumber,
        accountId: penaltyAccount.id,
        debitAmount: 0,
        creditAmount: data.amount,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    });

    await client.chartOfAccount.update({
      where: { id: loanAccount.id },
      data: buildAccountBalanceUpdate(loanAccount, { debitAmount: data.amount }),
    });

    await client.chartOfAccount.update({
      where: { id: penaltyAccount.id },
      data: buildAccountBalanceUpdate(penaltyAccount, { creditAmount: data.amount }),
    });
  };

  if (isTransaction) {
    await operations(tx);
  } else {
    await db.$transaction(async (newTx) => {
      await operations(newTx);
    });
  }

  return { success: true, entryNumber };
}

