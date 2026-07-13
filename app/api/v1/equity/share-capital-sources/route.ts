import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { getShareCapitalSummary } from "@/lib/services/share-capital-summary";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const accountTypeId = request.nextUrl.searchParams.get("accountTypeId");
    if (!accountTypeId) {
      return NextResponse.json(
        { success: false, error: "accountTypeId is required" },
        { status: 400 },
      );
    }

    const branchId = resolveBranchScope(
      user as { role: string; branchId?: string | null },
      request.nextUrl.searchParams.get("branchId"),
    );

    const summary = await getShareCapitalSummary(branchId);
    const accountType = summary.accountTypes.find((item) => item.id === accountTypeId);

    if (!accountType) {
      return NextResponse.json(
        { success: false, error: "Share account type not found" },
        { status: 404 },
      );
    }

    const sourceAccounts = summary.sourceAccounts.filter((item) => item.accountTypeId === accountTypeId);
    const transactions = summary.transactionRows.filter((item) => {
      const matchedAccountType = summary.sourceAccounts.find(
        (source) => source.accountId === item.accountId,
      );
      return matchedAccountType?.accountTypeId === accountTypeId;
    });

    return NextResponse.json({
      success: true,
      data: {
        accountType: {
          id: accountType.id,
          name: accountType.name,
          sharePrice: accountType.sharePrice,
          isShareAccount: accountType.isShareAccount,
        },
        sourceCount: sourceAccounts.length,
        sourceTotal: sourceAccounts.reduce((sum, row) => sum + Number(row.totalValue || 0), 0),
        transactionCount: transactions.length,
        transactionTotal: transactions.reduce((sum, row) => sum + Number(row.amount || 0), 0),
        sourceAccounts,
        transactions,
      },
    });
  } catch (error) {
    console.error("Error fetching share capital sources:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch share capital sources",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
