import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { getBranchFilterForService, getCashAtHandPrincipalTotal, getOperationalBalances } from "@/lib/services/financial-reports";
import { calculateAccountBalance } from "@/lib/accounting-rules";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;


// GET /api/v1/reports/financial-year/trial-balance?year=2024
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const requestedBranchId = searchParams.get("branchId") || undefined;
    const branchFilter = await getBranchFilterForService(user, requestedBranchId);
    const branchId = branchFilter.branchId;
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);

    const accounts = await db.chartOfAccount.findMany({
      where: { isActive: true },
      select: { id: true, accountCode: true, accountName: true, ledgerType: true },
      orderBy: { accountCode: "asc" },
    });

    const accountIds = accounts.map((a) => a.id);
    const [journalSummaries, opBalances] = await Promise.all([
      accountIds.length > 0
        ? db.journalEntry.groupBy({
            by: ["accountId"],
            where: {
              accountId: { in: accountIds },
              entryDate: { lte: endOfYear },
              ...(branchId
                ? {
                    OR: [
                      { transaction: { branchId } },
                      { transactionId: null, branchId },
                    ],
                  }
                : {}),
            },
            _sum: { debitAmount: true, creditAmount: true },
          })
        : [],
      getOperationalBalances(endOfYear, { branchId: branchId || undefined }),
    ]);
    const cashAtHandPrincipal = await getCashAtHandPrincipalTotal(
      endOfYear,
      branchId || undefined,
    );

    const summaryByAccount = new Map(
      journalSummaries.map((entry) => [
        entry.accountId,
        { debit: entry._sum.debitAmount || 0, credit: entry._sum.creditAmount || 0 },
      ]),
    );

    const normalizedAccounts = accounts.map((account) => {
      const summary = summaryByAccount.get(account.id);
      const debit = summary?.debit ?? 0;
      const credit = summary?.credit ?? 0;
      const signed = calculateAccountBalance(account.ledgerType, debit, credit);
      return {
        accountCode: account.accountCode,
        accountName: account.accountName,
        ledgerType: account.ledgerType,
        debitBalance: debit,
        creditBalance: credit,
        signedBalance: signed,
      };
    });

    // Override operational groups with aggregated data
    const overrideGroups: Array<{ prefixes: string[]; getOp: () => { debit: number; credit: number; signed: number } }> = [
      {
        prefixes: ["101100"],
        getOp: () => ({
          debit: cashAtHandPrincipal,
          credit: 0,
          signed: cashAtHandPrincipal,
        }),
      },
      {
        prefixes: ["107"],
        getOp: () => {
          const signed = opBalances.loanPortfolio;
          return { debit: signed, credit: 0, signed };
        },
      },
      {
        prefixes: ["201001", "201002", "201003", "201004", "200600", "200800", "200810", "200900"],
        getOp: () => {
          const signed = opBalances.memberSavingsDeposits + opBalances.fixedTermDeposits;
          return { credit: signed, debit: 0, signed };
        },
      },
      {
        prefixes: ["3005", "304"],
        getOp: () => {
          const signed = opBalances.shareCapital;
          return { credit: signed, debit: 0, signed };
        },
      },
      {
        prefixes: ["1010"],
        getOp: () => {
          const signed = opBalances.fixedAssetsNet;
          return { debit: signed, credit: 0, signed };
        },
      },
      {
        prefixes: ["200700"],
        getOp: () => {
          const signed = opBalances.accumulatedDepreciation;
          return { credit: signed, debit: 0, signed };
        },
      },
    ];

    for (const group of overrideGroups) {
      const grp = normalizedAccounts.filter((a) => group.prefixes.some((p) => a.accountCode.startsWith(p)));
      if (grp.length === 0) continue;
      const totalJeSigned = grp.reduce((s, a) => s + a.signedBalance, 0);
      const target = group.getOp();
      for (const acct of grp) {
        const ratio = totalJeSigned !== 0 ? Math.abs(acct.signedBalance / totalJeSigned) : 1 / grp.length;
        const assignedSigned = Math.round(target.signed * ratio * 100) / 100;
        if (acct.ledgerType === "ASSETS" || acct.ledgerType === "EXPENDITURES") {
          acct.debitBalance = assignedSigned >= 0 ? assignedSigned : 0;
          acct.creditBalance = assignedSigned < 0 ? Math.abs(assignedSigned) : 0;
        } else {
          acct.creditBalance = assignedSigned >= 0 ? assignedSigned : 0;
          acct.debitBalance = assignedSigned < 0 ? Math.abs(assignedSigned) : 0;
        }
        acct.signedBalance = assignedSigned;
      }
    }

    // Override INCOME accounts with operational income total
    {
      const incGrp = normalizedAccounts.filter((a) => a.ledgerType === "INCOME");
      if (incGrp.length > 0) {
        const incJeAvg = incGrp.reduce((s, a) => s + Math.abs(a.signedBalance), 0);
        for (const acct of incGrp) {
          const ratio = incJeAvg !== 0 ? Math.abs(acct.signedBalance / incJeAvg) : 1 / incGrp.length;
          const assigned = Math.round(opBalances.incomeTotal * ratio * 100) / 100;
          acct.debitBalance = 0;
          acct.creditBalance = assigned;
          acct.signedBalance = assigned;
        }
      }
    }

    // Override EXPENDITURE accounts with operational expenditure total
    {
      const expGrp = normalizedAccounts.filter((a) => a.ledgerType === "EXPENDITURES");
      if (expGrp.length > 0) {
        const expJeAvg = expGrp.reduce((s, a) => s + Math.abs(a.signedBalance), 0);
        for (const acct of expGrp) {
          const ratio = expJeAvg !== 0 ? Math.abs(acct.signedBalance / expJeAvg) : 1 / expGrp.length;
          const assigned = Math.round(opBalances.expenditureTotal * ratio * 100) / 100;
          acct.debitBalance = assigned;
          acct.creditBalance = 0;
          acct.signedBalance = assigned;
        }
      }
    }

    const grouped = normalizedAccounts.reduce((acc, account) => {
      if (!acc[account.ledgerType]) acc[account.ledgerType] = [];
      acc[account.ledgerType].push({
        accountCode: account.accountCode,
        accountName: account.accountName,
        ledgerType: account.ledgerType,
        debitBalance: account.debitBalance,
        creditBalance: account.creditBalance,
      });
      return acc;
    }, {} as Record<string, Array<{ accountCode: string; accountName: string; ledgerType: string; debitBalance: number; creditBalance: number }>>);

    const totals = {
      totalDebits: normalizedAccounts.reduce((sum, a) => sum + a.debitBalance, 0),
      totalCredits: normalizedAccounts.reduce((sum, a) => sum + a.creditBalance, 0),
    };

    const isBalanced = Math.abs(totals.totalDebits - totals.totalCredits) < 0.01;

    return NextResponse.json({
      data: {
        reportType: "Trial Balance (Financial Year)",
        financialYear: year,
        branchApplied: branchId || "all",
        accounts: grouped,
        totals,
        isBalanced,
        difference: totals.totalDebits - totals.totalCredits,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating FY trial balance:", error);
    return NextResponse.json(
      { error: "Failed to generate financial year trial balance" },
      { status: 500 }
    );
  }
}
