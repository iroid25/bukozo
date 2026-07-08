// app/api/v1/loan-repayments/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { LoanRepaymentRequestService } from "@/services/loan-repayment-request.service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { requestId, verificationCode } = await request.json();

    if (!requestId || !verificationCode) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const repaymentRequest = await db.loanRepaymentRequest.findUnique({
      where: { id: requestId },
      include: {
        loan: {
          include: {
            member: { include: { user: true } },
            loanApplication: { include: { loanProduct: true } },
          },
        },
        account: true,
      },
    });

    if (!repaymentRequest) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }

    if (repaymentRequest.status !== "PENDING") {
      return NextResponse.json({ success: false, error: `This request is already ${repaymentRequest.status}` }, { status: 400 });
    }

    if (new Date() > repaymentRequest.expiresAt) {
      await db.loanRepaymentRequest.update({ where: { id: requestId }, data: { status: "EXPIRED" } });
      return NextResponse.json({ success: false, error: "Code expired" }, { status: 400 });
    }

    if (repaymentRequest.smsCode !== verificationCode) {
      return NextResponse.json({ success: false, error: "Invalid verification code" }, { status: 400 });
    }

    // Process
    const result = await LoanRepaymentRequestService.processRepaymentTransaction(
      repaymentRequest.id,
      session.user.id,
      repaymentRequest.loanId ?? undefined,
      repaymentRequest.memberId ?? undefined,
      repaymentRequest.accountId,
      repaymentRequest.amount,
      repaymentRequest.loan,
      false,
      {
        interestAmount: repaymentRequest.interestPaid,
        penaltyAmount: repaymentRequest.penaltyPaid,
        principalAmount: repaymentRequest.principalPaid,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Repayment processed successfully",
      repayment: result.repayment,
      newOutstandingBalance: Math.max(0, result.newOutstanding),
    });
  } catch (error: any) {
    console.error("API Repayment Verify Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
