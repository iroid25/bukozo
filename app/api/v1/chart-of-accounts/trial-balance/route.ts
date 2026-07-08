import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { hydrateAccountsWithJournalBalances } from "@/lib/services/chartOfAccounts";
import { ensureCoreChartOfAccountsStructure } from "@/lib/services/chart-of-accounts-bootstrap";

// GET /api/v1/chart-of-accounts/trial-balance - Generate trial balance report
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await ensureCoreChartOfAccountsStructure();

    const searchParams = request.nextUrl.searchParams;
    const asOfDate = searchParams.get("asOfDate");
    const ledgerType = searchParams.get("ledgerType");

    // Build filter
    const where: any = {
      isActive: true,
    };

    if (ledgerType) {
      where.ledgerType = ledgerType;
    }

    // Get all active accounts
    const accounts = await db.chartOfAccount.findMany({
      where,
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        fullCode: true,
        ledgerType: true,
        level: true,
        balance: true,
        debitBalance: true,
        creditBalance: true,
      },
      orderBy: {
        accountCode: "asc",
      },
    });

    const hydratedAccounts = await hydrateAccountsWithJournalBalances(accounts);

    // Group by ledger type
    const grouped = hydratedAccounts.reduce((acc, account) => {
      if (!acc[account.ledgerType]) {
        acc[account.ledgerType] = [];
      }
      acc[account.ledgerType].push(account);
      return acc;
    }, {} as Record<string, typeof accounts>);

    // Calculate totals
    const totals = {
      totalDebits: 0,
      totalCredits: 0,
      byLedgerType: {} as Record<string, { debits: number; credits: number }>,
    };

    Object.entries(grouped).forEach(([type, accts]) => {
      const debits = accts.reduce((sum, a) => sum + Number(a.debitBalance || 0), 0);
      const credits = accts.reduce((sum, a) => sum + Number(a.creditBalance || 0), 0);
      
      totals.byLedgerType[type] = { debits, credits };
      totals.totalDebits += debits;
      totals.totalCredits += credits;
    });

    // Check if balanced
    const isBalanced = Math.abs(totals.totalDebits - totals.totalCredits) < 0.01;

    return NextResponse.json({
      data: {
        accounts: grouped,
        totals,
        isBalanced,
        difference: totals.totalDebits - totals.totalCredits,
        asOfDate: asOfDate || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating trial balance:", error);
    return NextResponse.json(
      { error: "Failed to generate trial balance" },
      { status: 500 }
    );
  }
}
