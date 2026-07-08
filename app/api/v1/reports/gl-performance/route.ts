import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { calculateAccountBalance, isDebitNormalBalance } from "@/lib/accounting-rules";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const JOURNAL_INCLUDE = {
  account: { select: { accountName: true, accountCode: true } },
  transaction: {
    select: {
      paymentMethod: true,
      externalReference: true,
      processedByUser: { select: { name: true } },
      member: { select: { user: { select: { name: true } } } },
    },
  },
  createdBy: { select: { name: true, branch: { select: { name: true } } } },
} as const;

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
    let branchIdFilter: string | undefined;
    if (user.role === UserRole.ADMIN) {
      if (requestedBranchId && requestedBranchId !== "ALL" && requestedBranchId !== "all") {
        branchIdFilter = requestedBranchId;
      }
    } else {
      if (user.branchId) branchIdFilter = user.branchId;
    }

    const branchCondition = branchIdFilter
      ? {
          OR: [
            { transaction: { branchId: branchIdFilter } },
            { transactionId: null as string | null, branchId: branchIdFilter },
            { createdBy: { branchId: branchIdFilter } },
          ],
        }
      : {};

    // ============================================================================
    // CASE A: SPECIFIC ACCOUNT CODE (e.g. accountCode=201003 or accountCode=300502)
    // ============================================================================
    if (accountCode) {
      const accounts = await db.chartOfAccount.findMany({
        where: { accountCode: { startsWith: accountCode }, isActive: true },
        orderBy: { accountCode: "asc" },
      });

      if (!accounts.length) {
        return NextResponse.json(
          { error: `No accounts found for code: ${accountCode}` },
          { status: 404 }
        );
      }

      const primaryAccount = accounts[0];
      const creditNormal = isCreditNormalType(primaryAccount.ledgerType);
      const accountIds = accounts.map((a) => a.id);

      const accountLabel =
        accounts.length === 1
          ? `${primaryAccount.accountCode} - ${primaryAccount.accountName}`
          : `${accountCode}xxx - ${primaryAccount.accountName}`;

      const openingEntries = await db.journalEntry.aggregate({
        where: {
          accountId: { in: accountIds },
          entryDate: { lt: startDate },
          ...branchCondition,
        },
        _sum: { debitAmount: true, creditAmount: true },
      });

      const openingDebit = openingEntries._sum.debitAmount || 0;
      const openingCredit = openingEntries._sum.creditAmount || 0;
      const openingBalance = creditNormal
        ? openingCredit - openingDebit
        : openingDebit - openingCredit;

      const periodEntries = await db.journalEntry.findMany({
        where: {
          accountId: { in: accountIds },
          entryDate: { gte: startDate, lte: endDate },
          ...branchCondition,
        },
        include: JOURNAL_INCLUDE,
        orderBy: { entryDate: "asc" },
      });

      let totalPeriodDebit = 0;
      let totalPeriodCredit = 0;
      const enrichedTransactions = periodEntries.map((entry) => {
        totalPeriodDebit += entry.debitAmount;
        totalPeriodCredit += entry.creditAmount;
        return {
          ...entry,
          effect: creditNormal
            ? entry.creditAmount - entry.debitAmount
            : entry.debitAmount - entry.creditAmount,
        };
      });

      const netPeriodMovement = creditNormal
        ? totalPeriodCredit - totalPeriodDebit
        : totalPeriodDebit - totalPeriodCredit;

      return NextResponse.json({
        success: true,
        data: {
          category: { id: accountCode, name: accountLabel, isCreditNormal: creditNormal },
          summary: {
            openingBalance,
            totalPeriodDebit,
            totalPeriodCredit,
            netPeriodMovement,
            closingBalance: openingBalance + netPeriodMovement,
          },
          transactions: enrichedTransactions,
        },
      });
    }

    // ============================================================================
    // CASE B: BROAD LEDGER CATEGORY (ASSETS / LIABILITIES / etc.)
    // ============================================================================
    if (category && category !== "all") {
      const isValidCategory = Object.keys(CATEGORY_LABELS).includes(category);
      if (!isValidCategory)
        return NextResponse.json({ error: "Invalid ledger category" }, { status: 400 });

      const accounts = await db.chartOfAccount.findMany({
        where: { ledgerType: category as any },
      });

      if (!accounts.length) {
        return NextResponse.json(
          { error: "No accounts found for this category" },
          { status: 404 }
        );
      }

      const accountIds = accounts.map((a) => a.id);
      const creditNormal = isCreditNormalType(category);

      const openingEntries = await db.journalEntry.aggregate({
        where: {
          accountId: { in: accountIds },
          entryDate: { lt: startDate },
          ...branchCondition,
        },
        _sum: { debitAmount: true, creditAmount: true },
      });

      const openingDebit = openingEntries._sum.debitAmount || 0;
      const openingCredit = openingEntries._sum.creditAmount || 0;
      const openingBalance = creditNormal
        ? openingCredit - openingDebit
        : openingDebit - openingCredit;

      const periodEntries = await db.journalEntry.findMany({
        where: {
          accountId: { in: accountIds },
          entryDate: { gte: startDate, lte: endDate },
          ...branchCondition,
        },
        include: JOURNAL_INCLUDE,
        orderBy: { entryDate: "asc" },
      });

      let totalPeriodDebit = 0;
      let totalPeriodCredit = 0;
      const enrichedTransactions = periodEntries.map((entry) => {
        totalPeriodDebit += entry.debitAmount;
        totalPeriodCredit += entry.creditAmount;
        return {
          ...entry,
          effect: creditNormal
            ? entry.creditAmount - entry.debitAmount
            : entry.debitAmount - entry.creditAmount,
        };
      });

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
          transactions: enrichedTransactions,
        },
      });
    }

    // ============================================================================
    // CASE C: ALL CATEGORIES SUMMARY
    // ============================================================================
    const allAccounts = await db.chartOfAccount.findMany({
      orderBy: { accountCode: "asc" },
    });

    const categories = {
      assets: { name: "Assets", accounts: [] as any[], totalBalance: 0 },
      liabilities: { name: "Liabilities", accounts: [] as any[], totalBalance: 0 },
      equity: { name: "Equity", accounts: [] as any[], totalBalance: 0 },
      income: { name: "Income", accounts: [] as any[], totalBalance: 0 },
      expenses: { name: "Expenses", accounts: [] as any[], totalBalance: 0 },
      others: { name: "Other Accounts", accounts: [] as any[], totalBalance: 0 },
    };

    allAccounts.forEach((acc) => {
      let catKey: keyof typeof categories = "others";
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
      }

      const balance = calculateAccountBalance(acc.ledgerType, acc.debitBalance, acc.creditBalance);
      categories[catKey].accounts.push({
        id: acc.id,
        code: acc.accountCode,
        name: acc.accountName,
        balance,
        debitBalance: acc.debitBalance,
        creditBalance: acc.creditBalance,
        isCreditNormal: !isDebitNormalBalance(acc.ledgerType),
      });
      categories[catKey].totalBalance += balance;
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
