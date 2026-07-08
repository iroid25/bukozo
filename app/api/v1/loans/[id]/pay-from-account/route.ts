import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { LoanService } from "@/services/loan.service";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only LOANOFFICER, TELLER, BRANCHMANAGER, ADMIN can process payments
    if (!["LOANOFFICER", "TELLER", "BRANCHMANAGER", "ADMIN"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const loanId = params.id;
    const body = await request.json();
    const { 
      sourceAccountId, 
      amount,
      interestPaid,
      penaltyPaid,
      principalPaid,
      notes
    } = body;

    if (!sourceAccountId || !amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid request. sourceAccountId and amount are required." },
        { status: 400 }
      );
    }

    // Call centralized LoanService.repay
    const result = await LoanService.repay({
      loanId,
      amount: amount,
      handlerId: user.id,
      handlerRole: user.role,
      channel: "ACCOUNT_TRANSFER",
      sourceAccountId: sourceAccountId,
      notes: notes || undefined,
      interestAmount: interestPaid || undefined,
      penaltyAmount: penaltyPaid || undefined,
      principalAmount: principalPaid || undefined
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Payment processed successfully",
      data: result.data,
    });
  } catch (error: any) {
    console.error("Payment from account error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process payment",
      },
      { status: 500 }
    );
  }
}
