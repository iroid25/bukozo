import { calculateAccountBalance } from "@/lib/accounting-rules";
import { db } from "@/prisma/db";
import { ensureIncomeStructure } from "@/lib/services/income-structure";

export class AccountingService {
  /**
   * Get all Chart of Accounts
   */
  static async getCOA(branchId?: string) {
    try {
      await ensureIncomeStructure();

      const includeFilter: any = {
        parent: {
          select: { id: true, accountCode: true, accountName: true },
        },
        _count: {
          select: { children: true, journalEntries: true },
        },
      };

      // If branchId is provided, we calculate the balance by branch for each account
      if (branchId) {
        // We'll fetch journal entries for this branch to calculate balances
        includeFilter.journalEntries = {
          where: {
            OR: [
              { transaction: { branchId } },
              { transactionId: null, branchId },
            ]
          },
          select: { debitAmount: true, creditAmount: true }
        };
      }

      const accounts = await db.chartOfAccount.findMany({
        where: { isActive: true },
        include: includeFilter,
        orderBy: { accountCode: "asc" },
      });

      // Transform balances if branch filtering is active
      const data = branchId ? accounts.map(acc => {
        const branchDebits = (acc as any).journalEntries.reduce((sum: number, j: any) => sum + (j.debitAmount || 0), 0);
        const branchCredits = (acc as any).journalEntries.reduce((sum: number, j: any) => sum + (j.creditAmount || 0), 0);
        const { journalEntries, ...rest } = acc;
        return {
          ...rest,
          debitBalance: branchDebits,
          creditBalance: branchCredits,
          balance: calculateAccountBalance(acc.ledgerType, branchDebits, branchCredits),
        };
      }) : accounts;

      return { ok: true, data };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get Trial Balance
   */
  static async getTrialBalance(branchId?: string) {
    try {
      const selectFilter: any = {
        id: true,
        accountCode: true,
        accountName: true,
        ledgerType: true,
        debitBalance: true,
        creditBalance: true,
        balance: true,
      };

      const includeFilter: any = {};

      if (branchId) {
        includeFilter.journalEntries = {
          where: {
            OR: [
              { transaction: { branchId } },
              { transactionId: null, branchId },
            ]
          },
          select: { debitAmount: true, creditAmount: true }
        };
      }

      const accountsRaw = await db.chartOfAccount.findMany({
        where: { isActive: true },
        include: includeFilter,
        orderBy: { accountCode: "asc" },
      });

      const accounts = branchId ? accountsRaw.map(acc => {
        const branchDebits = (acc as any).journalEntries.reduce((sum: number, j: any) => sum + (j.debitAmount || 0), 0);
        const branchCredits = (acc as any).journalEntries.reduce((sum: number, j: any) => sum + (j.creditAmount || 0), 0);
        return {
          id: acc.id,
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          ledgerType: acc.ledgerType,
          debitBalance: branchDebits,
          creditBalance: branchCredits,
          balance: calculateAccountBalance(acc.ledgerType, branchDebits, branchCredits),
        };
      }) : accountsRaw.map(acc => ({
        id: acc.id,
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        ledgerType: acc.ledgerType,
        debitBalance: acc.debitBalance,
        creditBalance: acc.creditBalance,
        balance: calculateAccountBalance(acc.ledgerType, acc.debitBalance, acc.creditBalance)
      }));

      const grouped = accounts.reduce((acc, account) => {
        if (!acc[account.ledgerType]) acc[account.ledgerType] = [];
        acc[account.ledgerType].push(account);
        return acc;
      }, {} as Record<string, any[]>);

      const totalDebits = accounts.reduce((sum, a) => sum + a.debitBalance, 0);
      const totalCredits = accounts.reduce((sum, a) => sum + a.creditBalance, 0);

      return {
        ok: true,
        data: {
          accounts: grouped,
          totalDebits,
          totalCredits,
          isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
          difference: totalDebits - totalCredits,
        },
      };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }
}
