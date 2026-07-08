"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { revalidatePath } from "next/cache";
import { AccountingService } from "@/services/accounting.service";

// Get all Chart of Accounts
export async function getAllChartOfAccounts() {
  const result = await AccountingService.getCOA();
  if (!result.ok) {
    return { success: false, error: result.error };
  }
  return { success: true, data: result.data };
}

// Get accounts by ledger type
export async function getAccountsByLedgerType(ledgerType: string) {
  try {
    const accounts = await db.chartOfAccount.findMany({
      where: {
        ledgerType: ledgerType as any,
        isActive: true,
      },
      orderBy: {
        accountCode: "asc",
      },
    });

    return { success: true, data: accounts };
  } catch (error) {
    console.error("Error fetching accounts by type:", error);
    return { success: false, error: "Failed to fetch accounts" };
  }
}

// Create journal entry when income is recorded
export async function createIncomeJournalEntry(data: {
  incomeId: string;
  amount: number;
  description: string;
  accountId: string; // The cash/bank account receiving money
  categoryId?: string;
}) {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error("Unauthorized");

    // Find the appropriate income account (4 - INCOME)
    const incomeAccount = await db.chartOfAccount.findFirst({
      where: {
        ledgerType: "INCOME",
        isActive: true,
        // You can make this more specific based on category
      },
    });

    // Find the cash/bank account (1 - ASSETS)
    const cashAccount = await db.chartOfAccount.findFirst({
      where: {
        accountCode: "102001", // CASH AT HAND or use data.accountId
        isActive: true,
      },
    });

    if (!incomeAccount || !cashAccount) {
      throw new Error("Required accounts not found");
    }

    const entryNumber = `JE-INC-${Date.now()}`;

    // Create journal entries (Debit Cash, Credit Income)
    await db.$transaction([
      // Debit: Cash/Bank (Asset increases)
      db.journalEntry.create({
        data: {
          entryNumber,
          accountId: cashAccount.id,
          debitAmount: data.amount,
          creditAmount: 0,
          description: data.description,
          reference: `Income-${data.incomeId}`,
          createdByUserId: user.id,
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
          reference: `Income-${data.incomeId}`,
          createdByUserId: user.id,
        },
      }),
      // Update account balances
      db.chartOfAccount.update({
        where: { id: cashAccount.id },
        data: {
          debitBalance: { increment: data.amount },
          balance: { increment: data.amount },
        },
      }),
      db.chartOfAccount.update({
        where: { id: incomeAccount.id },
        data: {
          creditBalance: { increment: data.amount },
          balance: { increment: data.amount },
        },
      }),
    ]);

    revalidatePath("/dashboard/accounting/chart-of-accounts");
    return { success: true, message: "Journal entry created" };
  } catch (error) {
    console.error("Error creating income journal entry:", error);
    return { success: false, error: "Failed to create journal entry" };
  }
}

// Create journal entry when expenditure is recorded
export async function createExpenditureJournalEntry(data: {
  expenditureId: string;
  amount: number;
  description: string;
  categoryId?: string;
}) {
  try {
    const user = await getAuthUser();
    if (!user) throw new Error("Unauthorized");

    // Find the appropriate expense account (5 - EXPENSES)
    const expenseAccount = await db.chartOfAccount.findFirst({
      where: {
        ledgerType: "EXPENDITURES",
        isActive: true,
      },
    });

    // Find the cash/bank account
    const cashAccount = await db.chartOfAccount.findFirst({
      where: {
        accountCode: "102001", // CASH AT HAND
        isActive: true,
      },
    });

    if (!expenseAccount || !cashAccount) {
      throw new Error("Required accounts not found");
    }

    const entryNumber = `JE-EXP-${Date.now()}`;

    // Create journal entries (Debit Expense, Credit Cash)
    await db.$transaction([
      // Debit: Expense (Expense increases)
      db.journalEntry.create({
        data: {
          entryNumber,
          accountId: expenseAccount.id,
          debitAmount: data.amount,
          creditAmount: 0,
          description: data.description,
          reference: `Expenditure-${data.expenditureId}`,
          createdByUserId: user.id,
        },
      }),
      // Credit: Cash/Bank (Asset decreases)
      db.journalEntry.create({
        data: {
          entryNumber,
          accountId: cashAccount.id,
          debitAmount: 0,
          creditAmount: data.amount,
          description: data.description,
          reference: `Expenditure-${data.expenditureId}`,
          createdByUserId: user.id,
        },
      }),
      // Update account balances
      db.chartOfAccount.update({
        where: { id: expenseAccount.id },
        data: {
          debitBalance: { increment: data.amount },
          balance: { increment: data.amount },
        },
      }),
      db.chartOfAccount.update({
        where: { id: cashAccount.id },
        data: {
          creditBalance: { increment: data.amount },
          balance: { decrement: data.amount },
        },
      }),
    ]);

    revalidatePath("/dashboard/accounting/chart-of-accounts");
    return { success: true, message: "Journal entry created" };
  } catch (error) {
    console.error("Error creating expenditure journal entry:", error);
    return { success: false, error: "Failed to create journal entry" };
  }
}

// Get trial balance
export async function getTrialBalance() {
  const result = await AccountingService.getTrialBalance();
  if (!result.ok) {
    return { success: false, error: result.error };
  }
  return { success: true, data: result.data };
}
