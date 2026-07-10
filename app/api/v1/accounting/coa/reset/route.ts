import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { ensureCoreChartOfAccountsStructure } from "@/lib/services/chart-of-accounts-bootstrap";
import { ensureEquityStructure } from "@/lib/services/equity-structure";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Admin only" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== "RESET_COA") {
      return NextResponse.json(
        {
          success: false,
          error: "Reset confirmation missing",
          details: "Pass confirm: RESET_COA to delete and rebuild the Chart of Accounts.",
        },
        { status: 400 },
      );
    }

    const resetResult = await db.$transaction(async (tx) => {
      await tx.fixedAsset.updateMany({
        data: {
          accountId: null,
          accumulatedDepreciationAccountId: null,
          depreciationExpenseAccountId: null,
        },
      });

      await tx.loanProduct.updateMany({
        data: {
          ledgerAccountId: null,
          interestAccountId: null,
          penaltyAccountId: null,
          feeAccountId: null,
        },
      });

      await tx.accountType.updateMany({
        data: {
          ledgerAccountId: null,
        },
      });

      await tx.transaction.updateMany({
        data: {
          creditAccountId: null,
          debitAccountId: null,
        },
      });

      const journalEntriesDeleted = await tx.journalEntry.deleteMany({});
      const accountTransactionsDeleted = await tx.accountTransaction.deleteMany({});
      const chartOfAccountsDeleted = await tx.chartOfAccount.deleteMany({});

      return {
        journalEntriesDeleted: journalEntriesDeleted.count,
        accountTransactionsDeleted: accountTransactionsDeleted.count,
        chartOfAccountsDeleted: chartOfAccountsDeleted.count,
      };
    });

    const rebuilt = await ensureCoreChartOfAccountsStructure();
    await ensureEquityStructure();
    const syncState = await bumpAccountingSyncState("Hard COA reset");

    return NextResponse.json(
      {
        success: true,
        message: "Chart of Accounts reset and rebuilt successfully",
        data: {
          resetResult,
          rebuilt,
          syncState,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error resetting chart of accounts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reset Chart of Accounts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
