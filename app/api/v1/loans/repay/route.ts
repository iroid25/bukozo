import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { LoanService } from "@/services/loan.service";

/**
 * POST: Process a loan repayment
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { loanId, amount, channel, reference } = body;

    if (!loanId || !amount || !channel) {
        return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const result = await LoanService.repay({
      loanId,
      amount: Number(amount),
      handlerId: user.id,
      channel,
      reference,
    });

    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
