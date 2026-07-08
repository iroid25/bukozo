import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { AccountStatus } from "@prisma/client";

import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { accountId } = await params;

    const account = await db.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        balance: true,
        status: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (account.status === AccountStatus.CLOSED) {
      return NextResponse.json({ error: "Account is already closed" }, { status: 400 });
    }

    if (account.balance > 0) {
      return NextResponse.json(
        { error: "Cannot close account with remaining balance. Please withdraw all funds first." },
        { status: 400 },
      );
    }

    const updatedAccount = await db.account.update({
      where: { id: accountId },
      data: {
        status: AccountStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedAccount,
    });
  } catch (error) {
    console.error("Error closing account:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to close account",
      },
      { status: 500 },
    );
  }
}
