import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = String((session.user as any)?.role || "").toUpperCase();
    if (role !== "ADMIN" && role !== "ACCOUNTANT") {
      return NextResponse.json(
        { error: "Permission denied. Only Admins/Accountants can set custom fees." },
        { status: 403 },
      );
    }

    const { accountId } = await params;
    const body = await request.json().catch(() => ({}));

    const customFlatWithdrawalFee =
      body.customFlatWithdrawalFee === "" || body.customFlatWithdrawalFee === undefined
        ? null
        : body.customFlatWithdrawalFee === null
          ? null
          : Number(body.customFlatWithdrawalFee);

    const customWithdrawalFeePercentage =
      body.customWithdrawalFeePercentage === "" || body.customWithdrawalFeePercentage === undefined
        ? null
        : body.customWithdrawalFeePercentage === null
          ? null
          : Number(body.customWithdrawalFeePercentage);

    const updatedAccount = await db.account.update({
      where: { id: accountId },
      data: {
        customFlatWithdrawalFee,
        customWithdrawalFeePercentage,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedAccount,
    });
  } catch (error) {
    console.error("Error updating account fees:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update account fees",
      },
      { status: 500 },
    );
  }
}
