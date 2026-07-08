import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { LoanService } from "@/services/loan.service";

/**
 * POST: Disburse an approved loan
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { 
      applicationId, 
      amount, 
      periodMonths, 
      repaymentStartDate,
      gracePeriod,
      processingFeePercentage 
    } = body;

    if (!applicationId) {
        return NextResponse.json({ success: false, error: "applicationId is required" }, { status: 400 });
    }

    const result = await LoanService.disburse(applicationId, user.id, {
      amount,
      periodMonths,
      repaymentStartDate,
      gracePeriod,
      processingFeePercentage
    });

    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
