import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { TransactionStatus } from "@prisma/client";

const transactionInclude = {
  member: { include: { user: true } },
  institution: true,
  account: { include: { accountType: true, branch: true } },
  processedByUser: true,
};

export async function GET(request: NextRequest) {
  try {
    const transactions = await db.transaction.findMany({
      where: { status: TransactionStatus.PENDING },
      include: transactionInclude,
      orderBy: { transactionDate: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error("Error fetching pending transactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch pending transactions" },
      { status: 500 }
    );
  }
}
