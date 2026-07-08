// FILE: app/api/v1/loanRepaymentRequests/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { LoanRepaymentRequestService } from "@/services/loan-repayment-request.service";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { requestId, verificationCode } = body;

    if (!requestId || !verificationCode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get request
    const repaymentRequest = await db.loanRepaymentRequest.findUnique({
      where: { id: requestId },
      include: {
        loan: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
            loanApplication: {
              include: {
                loanProduct: true,
              },
            },
          },
        },
        account: true,
      },
    });

    if (!repaymentRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Check status
    if (repaymentRequest.status !== "PENDING") {
      return NextResponse.json(
        {
          error: `This request has already been ${repaymentRequest.status.toLowerCase()}`,
        },
        { status: 400 }
      );
    }

    // Check expiration
    if (new Date() > repaymentRequest.expiresAt) {
      await db.loanRepaymentRequest.update({
        where: { id: repaymentRequest.id },
        data: { status: "EXPIRED" },
      });

      return NextResponse.json(
        { error: "Verification code has expired" },
        { status: 400 }
      );
    }

    // Verify code
    if (repaymentRequest.smsCode !== verificationCode) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Check balance again
    const currentAccount = await db.account.findUnique({
      where: { id: repaymentRequest.accountId },
    });

    if (!currentAccount || currentAccount.balance < repaymentRequest.amount) {
      return NextResponse.json(
        { error: "Insufficient account balance" },
        { status: 400 }
      );
    }

    const result = await LoanRepaymentRequestService.processRepaymentTransaction(
      repaymentRequest.id,
      user.id,
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
      },
    );

    // Send notifications
    await db.notification.create({
      data: {
        userId: repaymentRequest.loan!.member.user.id,
        type: "IN_APP",
        subject: "Loan Repayment Processed",
        message: `Your loan repayment of ${formatCurrency(
          repaymentRequest.amount
        )} has been processed successfully. New outstanding balance: ${formatCurrency(
          Math.max(0, result.newOutstanding)
        )}`,
        targetAddress: `/dashboard/my-loans`,
        sentAt: new Date(),
        isRead: false,
        status: "SENT",
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Loan repayment processed successfully",
        repayment: result.repayment,
        newOutstandingBalance: Math.max(0, result.newOutstanding),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error verifying repayment:", error);
    return NextResponse.json(
      { error: "Failed to process repayment" },
      { status: 500 }
    );
  }
}
