import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { TransactionService } from "@/services/transaction.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Role-based branch filtering
    const branchId = ["ADMIN", "SUPERADMIN"].includes(user.role) 
      ? (new URL(request.url).searchParams.get("branchId") || undefined)
      : user.branchId || undefined;

    const result = await TransactionService.getStatistics(branchId, true);

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
