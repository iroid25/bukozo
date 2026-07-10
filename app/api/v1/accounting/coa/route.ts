import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { AccountingService } from "@/services/accounting.service";
import { ensureCoreChartOfAccountsStructure } from "@/lib/services/chart-of-accounts-bootstrap";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const branchId = user.role !== "ADMIN" ? user.branchId : undefined;
    
    let result;
    if (type === "trial-balance") {
      result = await AccountingService.getTrialBalance(branchId);
    } else {
      result = await AccountingService.getCOA(branchId);
    }

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "ACCOUNTANT"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 });
    }

    const result = await ensureCoreChartOfAccountsStructure();
    const syncState = await bumpAccountingSyncState("Manual COA refresh");

    return NextResponse.json(
      {
        success: true,
        message: "Chart of Accounts refreshed successfully",
        data: { result, syncState },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error refreshing chart of accounts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to refresh Chart of Accounts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
