import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { LoanService } from "@/services/loan.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId") || undefined;
    
    let branchId = searchParams.get("branchId") || undefined;
    if (["TELLER", "BRANCHMANAGER"].includes(user.role) && user.branchId) {
        branchId = user.branchId;
    }

    const result = await LoanService.getStatistics({ memberId, branchId });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
