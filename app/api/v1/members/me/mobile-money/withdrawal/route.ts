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
    const amount = Number(body.amount);
    const phoneNumber = body.phoneNumber || body.msisdn || member.user.phone || "";

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be a positive number" },
        { status: 400 },
      );
    }

    const result = await RelworxPaymentService.initiateWithdrawal(
      member.id,
      phoneNumber,
      amount,
      body.description || "SACCO Withdrawal",
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to initiate withdrawal",
      },
      { status: 400 },
    );
  }
}
