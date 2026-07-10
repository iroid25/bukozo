import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { calculateAccountBalance } from "@/lib/accounting-rules";
import { db } from "@/prisma/db";
import { hydrateAccountsWithJournalBalances } from "@/lib/services/chartOfAccounts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/v1/reports/financial/summary - Financial summary (live from journal entries)
export async function GET(request: NextRequest) {
  return generateSummary(request);
}

export async function POST(request: NextRequest) {
  return generateSummary(request);
}

async function generateSummary(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all active accounts and hydrate with live journal balances
    const accounts = await db.chartOfAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        ledgerType: true,
        debitBalance: true,
        creditBalance: true,
        balance: true,
      },
    });

    const hydrated = await hydrateAccountsWithJournalBalances(accounts);

    // Calculate totals by ledger type
    const summary = {
      totalIncome: 0,
      totalExpenses: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      netProfit: 0,
      profitMargin: 0,
    };

    hydrated.forEach((account: any) => {
      switch (account.ledgerType) {
        case "INCOME":
          summary.totalIncome += calculateAccountBalance(
            account.ledgerType,
            account.debitBalance,
            account.creditBalance,
          );
          break;
        case "EXPENDITURES":
          summary.totalExpenses += calculateAccountBalance(
            account.ledgerType,
            account.debitBalance,
            account.creditBalance,
          );
          break;
        case "ASSETS":
          summary.totalAssets += calculateAccountBalance(
            account.ledgerType,
            account.debitBalance,
            account.creditBalance,
          );
          break;
        case "LIABILITIES":
          summary.totalLiabilities += calculateAccountBalance(
            account.ledgerType,
            account.debitBalance,
            account.creditBalance,
          );
          break;
        case "EQUITY":
          summary.totalEquity += calculateAccountBalance(
            account.ledgerType,
            account.debitBalance,
            account.creditBalance,
          );
          break;
      }
    });

    // Calculate net profit and margin
    summary.netProfit = summary.totalIncome - summary.totalExpenses;
    summary.profitMargin = summary.totalIncome > 0 
      ? (summary.netProfit / summary.totalIncome) * 100 
      : 0;

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error generating financial summary:", error);
    return NextResponse.json(
      { error: "Failed to generate financial summary" },
      { status: 500 }
    );
  }
}
