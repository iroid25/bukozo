import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";

const transactionInclude = {
  member: {
    include: { user: true },
  },
  account: {
    include: {
      accountType: true,
      branch: true,
    },
  },
  processedByUser: true,
  deposit: {
    include: { handler: true },
  },
  withdrawal: {
    include: { handler: true },
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    // Await the params object (Next.js 15 requirement)
    const { memberId } = await params;

    const transactions = await db.transaction.findMany({
      where: { memberId },
      include: transactionInclude,
      orderBy: { transactionDate: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error("Error fetching member transactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch member transactions" },
      { status: 500 }
    );
  }
}
