import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";

const transactionInclude = {
  member: { include: { user: true } },
  institution: true,
  account: { include: { accountType: true, branch: true } },
  processedByUser: true,
  deposit: { include: { handler: true } },
  withdrawal: { include: { handler: true } },
};

export async function GET(request: NextRequest) {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));

    const transactions = await db.transaction.findMany({
      where: { transactionDate: { gte: startOfDay } },
      include: transactionInclude,
      orderBy: { transactionDate: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error("Error fetching today's transactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch today's transactions" },
      { status: 500 }
    );
  }
}
