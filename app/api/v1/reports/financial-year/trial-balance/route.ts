import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { getBranchFilterForService } from "@/lib/services/financial-reports";
import { getDirectTrialBalanceAccounts } from "@/lib/reports/direct-source";

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
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);

    const directAccounts = await getDirectTrialBalanceAccounts(startOfYear, endOfYear, branchId || undefined);

    const normalizedAccounts = directAccounts
      .filter((a) => !a.isGroup)
      .map((account) => ({
        accountCode: account.accountCode,
        accountName: account.accountName,
        ledgerType: account.ledgerType,
        debitBalance: account.debit,
        creditBalance: account.credit,
        signedBalance: account.balance,
      }));

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
