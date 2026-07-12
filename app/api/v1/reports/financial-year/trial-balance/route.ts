import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { getBranchFilterForService } from "@/lib/services/financial-reports";
import { getDirectTrialBalanceAccounts } from "@/lib/reports/direct-source";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TBEntry = {
  accountCode: string;
  accountName: string;
  ledgerType: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
};

const LEDGER_ORDER = ["ASSETS", "LIABILITIES", "EQUITY", "INCOME", "EXPENDITURES"] as const;

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

    const priorYearEnd = new Date(`${year - 1}-12-31T23:59:59.999Z`);

    const [openingAccounts, closingAccounts] = await Promise.all([
      getDirectTrialBalanceAccounts(priorYearEnd, priorYearEnd, branchId || undefined),
      getDirectTrialBalanceAccounts(endOfYear, endOfYear, branchId || undefined),
    ]);

    const closingByCode = new Map(closingAccounts.filter((a) => !a.isGroup).map((a) => [a.accountCode, a]));

    const entries: TBEntry[] = [];

    for (const [code, closing] of closingByCode) {
      const opening = openingAccounts.find((a) => a.accountCode === code && !a.isGroup);

      const isDebitNormal = closing.ledgerType === "ASSETS" || closing.ledgerType === "EXPENDITURES";

      const openBal = opening?.balance || 0;
      const closeBal = closing.balance;

      const openDr = isDebitNormal ? Math.max(openBal, 0) : openBal < 0 ? Math.abs(openBal) : 0;
      const openCr = !isDebitNormal ? Math.max(openBal, 0) : openBal < 0 ? Math.abs(openBal) : 0;

      const closeDr = isDebitNormal ? Math.max(closeBal, 0) : closeBal < 0 ? Math.abs(closeBal) : 0;
      const closeCr = !isDebitNormal ? Math.max(closeBal, 0) : closeBal < 0 ? Math.abs(closeBal) : 0;

      const periodDr = Math.max(closeDr - openDr, 0);
      const periodCr = Math.max(closeCr - openCr, 0);

      if (Math.abs(openBal) < 0.001 && Math.abs(closeBal) < 0.001) continue;

      entries.push({
        accountCode: closing.accountCode,
        accountName: closing.accountName,
        ledgerType: closing.ledgerType,
        openingDebit: openDr,
        openingCredit: openCr,
        periodDebit: periodDr,
        periodCredit: periodCr,
        closingDebit: closeDr,
        closingCredit: closeCr,
      });
    }

    const groups: Record<string, TBEntry[]> = {};
    for (const lt of LEDGER_ORDER) {
      groups[lt] = entries.filter((e) => e.ledgerType === lt);
    }

    const totalDebit = entries.reduce((s, e) => s + e.closingDebit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.closingCredit, 0);
    const difference = totalDebit - totalCredit;

    return NextResponse.json({
      data: {
        reportType: "Trial Balance (Financial Year)",
        period: { startDate: startOfYear.toISOString(), endDate: endOfYear.toISOString() },
        groups,
        entries,
        totals: {
          debit: totalDebit,
          credit: totalCredit,
          difference,
          balanced: Math.abs(difference) < 0.01,
        },
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
