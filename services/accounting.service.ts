import { calculateAccountBalance } from "@/lib/accounting-rules";
import { db } from "@/prisma/db";
import { ensureCoreChartOfAccountsStructure } from "@/lib/services/chart-of-accounts-bootstrap";
import { HIDDEN_COA_CODES } from "@/lib/accounting/coa-identity";
import { hydrateAccountsWithJournalBalances } from "@/lib/services/chartOfAccounts";

export class AccountingService {
  /**
   * Get all Chart of Accounts (with live journal-entry-hydrated balances)
   */
  static async getCOA(branchId?: string) {
    try {
      await ensureCoreChartOfAccountsStructure();

      const accounts = await db.chartOfAccount.findMany({
        where: {
          isActive: true,
          accountCode: { notIn: Array.from(HIDDEN_COA_CODES) },
        },
        include: {
          parent: {
            select: { id: true, accountCode: true, accountName: true },
          },
          _count: {
            select: { children: true, journalEntries: true },
          },
        },
        orderBy: { accountCode: "asc" },
      });

      const hydrated = await hydrateAccountsWithJournalBalances(accounts, branchId);

      return { ok: true, data: hydrated };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get Trial Balance (with live journal-entry-hydrated balances)
   */
  static async getTrialBalance(branchId?: string) {
    try {
      let accounts = await db.chartOfAccount.findMany({
        where: {
          isActive: true,
          accountCode: { notIn: Array.from(HIDDEN_COA_CODES) },
        },
        orderBy: { accountCode: "asc" },
      });

      const hydrated = await hydrateAccountsWithJournalBalances(accounts, branchId);

      const grouped = hydrated.reduce((acc: Record<string, any[]>, account: any) => {
        if (!acc[account.ledgerType]) acc[account.ledgerType] = [];
        acc[account.ledgerType].push(account);
        return acc;
      }, {} as Record<string, any[]>);

      const totalDebits = hydrated.reduce((sum: number, a: any) => sum + Number(a.debitBalance || 0), 0);
      const totalCredits = hydrated.reduce((sum: number, a: any) => sum + Number(a.creditBalance || 0), 0);

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
