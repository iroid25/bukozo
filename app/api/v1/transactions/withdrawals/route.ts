import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { TransactionType } from "@prisma/client";

const transactionInclude = {
  member: { include: { user: true } },
  institution: true,
  account: { include: { accountType: true, branch: true } },
  processedByUser: true,
  withdrawal: { include: { handler: true } },
};

export async function GET(request: NextRequest) {
  try {
    const transactions = await db.transaction.findMany({
      where: { type: TransactionType.WITHDRAWAL },
      include: transactionInclude,
      orderBy: { transactionDate: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error("Error fetching withdrawals:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch withdrawals" },
      { status: 500 }
    );
  }
}
