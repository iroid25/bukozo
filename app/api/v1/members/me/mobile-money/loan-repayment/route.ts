import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { RelworxPaymentService } from "@/services/relworx-payment.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "MEMBER") {
      return NextResponse.json(
        { success: false, error: "Member role required" },
        { status: 403 },
      );
    }

    const member = await db.member.findUnique({
      where: { userId: user.id },
      include: {
        user: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: "Member profile not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const loanId = body.loanId as string | undefined;
    const amount = Number(body.amount);
    const phoneNumber = body.phoneNumber || body.msisdn || member.user.phone || "";

    if (!loanId) {
      return NextResponse.json(
        { success: false, error: "loanId is required" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be a positive number" },
        { status: 400 },
      );
    }

    const result = await RelworxPaymentService.initiateLoanRepayment(
      member.id,
      loanId,
      phoneNumber,
      amount,
      body.description || `Loan Repayment #${loanId}`,
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to initiate loan repayment",
      },
      { status: 400 },
    );
  }
}
