import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { recordInsuranceSettlement } from "@/lib/services/loanInsurance";
import { CASH_AT_HAND_CODE } from "@/lib/services/asset-structure";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "ACCOUNTANT"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const amount = Number(body.amount || 0);
    const description = String(body.description || "").trim();
    const reference = body.reference ? String(body.reference).trim() : null;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 },
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 },
      );
    }

    const payment = await db.$transaction(async (tx) => {
      return recordInsuranceSettlement({
        tx,
        amount,
        createdById: user.id,
        description,
        reference,
        creditAccountCode: CASH_AT_HAND_CODE,
      });
    });

    return NextResponse.json({ success: true, data: payment });
  } catch (error) {
    console.error("Error recording insurance payment:", error);
    return NextResponse.json(
      { error: "Failed to record insurance payment" },
      { status: 500 },
    );
  }
}
