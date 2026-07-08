import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { LoanService } from "@/services/loan.service";

/**
 * GET: List loans with filtered data
 * POST: Submit new loan application
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId") || undefined;
    const status = (searchParams.get("status") as any) || undefined;
    
    // Role based filtering logic
    let branchId = searchParams.get("branchId") || undefined;
    const allocatedTellerId = searchParams.get("allocatedTellerId") || undefined;
    let finalAllocatedTellerId = allocatedTellerId;

    if (user.role === "TELLER") {
        if (user.branchId) branchId = user.branchId;
        // Tellers only see loans they are allocated to process
        if (!finalAllocatedTellerId) finalAllocatedTellerId = user.id;
    } else if (user.role === "LOANOFFICER") {
        // Loan officers see all loans in their branch (their link is via loanApplication.loanOfficerId)
        if (user.branchId) branchId = user.branchId;
    } else if (user.role === "BRANCHMANAGER" && user.branchId) {
        branchId = user.branchId;
    }

    const result = await LoanService.getLoans({ memberId, status, branchId, allocatedTellerId: finalAllocatedTellerId });
    if (!result.ok) {
        console.error("❌ LoanService.getLoans failed:", result.error);
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { memberId, productId, amount, purpose, periodMonths } = body;

    if (!memberId || !productId || !amount) {
        return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const result = await LoanService.apply({
      memberId,
      productId,
      amount: Number(amount),
      purpose,
      officerId: user.id,
      periodMonths: periodMonths ? Number(periodMonths) : undefined,
    });

    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
