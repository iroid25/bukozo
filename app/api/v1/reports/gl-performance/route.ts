import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { isDebitNormalBalance } from "@/lib/accounting-rules";
import { db } from "@/prisma/db";
import { getDirectBalanceSheetAccounts, getDirectIncomeExpenseAccounts, getSourceDrilldown, getDirectAccountsByCategory } from "@/lib/reports/direct-source";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  ASSETS: "Assets",
  LIABILITIES: "Liabilities",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENDITURES: "Expenses",
};

function isCreditNormalType(ledgerType: string) {
  return ["LIABILITIES", "EQUITY", "INCOME"].includes(ledgerType);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const searchParams = request.nextUrl.searchParams;

    const category = searchParams.get("category");
    const accountCode = searchParams.get("accountCode");
    const startDateParam =
      searchParams.get("startDate") ||
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const endDateParam = searchParams.get("endDate") || new Date().toISOString();
    const requestedBranchId = searchParams.get("branchId");

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);
    endDate.setHours(23, 59, 59, 999);

    // Branch filter
    const branchIdFilter = resolveBranchScope(
      { role: user.role, branchId: user.branchId },
      requestedBranchId && requestedBranchId !== "ALL" && requestedBranchId !== "all"
        ? requestedBranchId
        : undefined,
    );

    // ============================================================================
    // CASE A: SPECIFIC ACCOUNT CODE — source-table drilldown
    // ============================================================================
    if (accountCode) {
      const result = await getSourceDrilldown(accountCode, startDate, endDate, branchIdFilter);
      const creditNormal = isCreditNormalType(result.ledgerType);

      // Compute opening balance from direct source
      let openingBalance = 0;
      if (["ASSETS", "LIABILITIES", "EQUITY"].includes(result.ledgerType)) {
        const bsAccounts = await getDirectBalanceSheetAccounts(startDate, branchIdFilter);
        const match = bsAccounts.find((a) => a.accountCode === accountCode);
        openingBalance = match?.balance || 0;
      } else if (["INCOME", "EXPENDITURES"].includes(result.ledgerType)) {
        const startOfYear = new Date(startDate.getFullYear(), 0, 1);
        const ieAccounts = await getDirectIncomeExpenseAccounts(startOfYear, startDate, branchIdFilter);
        const match = ieAccounts.find((a) => a.accountCode === accountCode);
        openingBalance = match?.balance || 0;
      }

      const totalPeriodDebit = result.totals.debit;
      const totalPeriodCredit = result.totals.credit;
      const netPeriodMovement = creditNormal
        ? totalPeriodCredit - totalPeriodDebit
        : totalPeriodDebit - totalPeriodCredit;

      const transactions = result.entries.map((e) => ({
        date: e.date,
        reference: e.reference,
        description: e.description,
        debitAmount: e.debit,
        creditAmount: e.credit,
        effect: creditNormal ? e.credit - e.debit : e.debit - e.credit,
      }));

      return NextResponse.json({
        success: true,
        data: {
          category: { id: accountCode, name: result.accountName, isCreditNormal: creditNormal },
          summary: {
            openingBalance,
            totalPeriodDebit,
            totalPeriodCredit,
            netPeriodMovement,
            closingBalance: openingBalance + netPeriodMovement,
          },
          transactions,
        },
      });
    }

    // ============================================================================
    // CASE B: BROAD LEDGER CATEGORY — source-table drilldown
    // ============================================================================
    if (category && category !== "all") {
      const isValidCategory = Object.keys(CATEGORY_LABELS).includes(category);
      if (!isValidCategory)
        return NextResponse.json({ error: "Invalid ledger category" }, { status: 400 });

      const creditNormal = isCreditNormalType(category);

      // Opening balance from direct source
      let openingBalance = 0;
      if (["ASSETS", "LIABILITIES", "EQUITY"].includes(category)) {
        const bsAccounts = await getDirectBalanceSheetAccounts(startDate, branchIdFilter);
        openingBalance = bsAccounts
          .filter((a) => a.ledgerType === category && !a.isGroup)
          .reduce((sum, a) => sum + a.balance, 0);
      } else if (["INCOME", "EXPENDITURES"].includes(category)) {
        const startOfYear = new Date(startDate.getFullYear(), 0, 1);
        const ieAccounts = await getDirectIncomeExpenseAccounts(startOfYear, startDate, branchIdFilter);
        openingBalance = ieAccounts
          .filter((a) => a.ledgerType === category && !a.isGroup)
          .reduce((sum, a) => sum + a.balance, 0);
      }

      // Get all direct accounts for this category and drill down into each
      const categoryAccounts = await getDirectAccountsByCategory(category, startDate, endDate, branchIdFilter);
      const leafAccounts = categoryAccounts.filter((a) => !a.isGroup);

      let totalPeriodDebit = 0;
      let totalPeriodCredit = 0;
      const allTransactions: any[] = [];

      for (const acct of leafAccounts) {
        const drilldown = await getSourceDrilldown(acct.accountCode, startDate, endDate, branchIdFilter);
        totalPeriodDebit += drilldown.totals.debit;
        totalPeriodCredit += drilldown.totals.credit;
        for (const e of drilldown.entries) {
          allTransactions.push({
            date: e.date,
            reference: e.reference,
            description: `[${acct.accountCode}] ${e.description}`,
            debitAmount: e.debit,
            creditAmount: e.credit,
            effect: creditNormal ? e.credit - e.debit : e.debit - e.credit,
          });
        }
      }

      allTransactions.sort((a, b) => a.date.localeCompare(b.date));

      const netPeriodMovement = creditNormal
        ? totalPeriodCredit - totalPeriodDebit
        : totalPeriodDebit - totalPeriodCredit;

      return NextResponse.json({
        success: true,
        data: {
          category: {
            id: category,
            name: CATEGORY_LABELS[category] || category,
            isCreditNormal: creditNormal,
          },
          summary: {
            openingBalance,
            totalPeriodDebit,
            totalPeriodCredit,
            netPeriodMovement,
            closingBalance: openingBalance + netPeriodMovement,
          },
          transactions: allTransactions,
        },
      });
    }

    // ============================================================================
    // CASE C: ALL CATEGORIES SUMMARY (direct source)
    // ============================================================================
    const [bsAccounts, ieAccounts] = await Promise.all([
      getDirectBalanceSheetAccounts(endDate, branchIdFilter),
      getDirectIncomeExpenseAccounts(startDate, endDate, branchIdFilter),
    ]);
    const allDirectAccounts = [...bsAccounts, ...ieAccounts];

    const categories = {
      assets: { name: "Assets", accounts: [] as any[], totalBalance: 0 },
      liabilities: { name: "Liabilities", accounts: [] as any[], totalBalance: 0 },
      equity: { name: "Equity", accounts: [] as any[], totalBalance: 0 },
      income: { name: "Income", accounts: [] as any[], totalBalance: 0 },
      expenses: { name: "Expenses", accounts: [] as any[], totalBalance: 0 },
    };

    allDirectAccounts.forEach((acc) => {
      let catKey: keyof typeof categories;
      switch (acc.ledgerType) {
        case "ASSETS":
          catKey = "assets";
          break;
        case "LIABILITIES":
          catKey = "liabilities";
          break;
        case "EQUITY":
          catKey = "equity";
          break;
        case "INCOME":
          catKey = "income";
          break;
        case "EXPENDITURES":
          catKey = "expenses";
          break;
        default:
          return;
      }

      categories[catKey].accounts.push({
        id: acc.id,
        code: acc.accountCode,
        name: acc.accountName,
        balance: acc.balance,
        debitBalance: acc.debit,
        creditBalance: acc.credit,
        isCreditNormal: !isDebitNormalBalance(acc.ledgerType),
      });
      categories[catKey].totalBalance += acc.balance;
    });

    return NextResponse.json({
      success: true,
      data: {
        reportType: "GL Performance Overview",
        period: { startDate, endDate },
        categories: Object.values(categories).filter((c) => c.accounts.length > 0),
      },
    });
  } catch (error: any) {
    console.error("Error fetching GL Performance Report:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}
