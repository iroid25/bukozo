import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/v1/reports/transactions/sequence-transaction?startDate=&endDate=
// Lists ALL transactions ordered by their actual transactionDate (value date).
// Source: Transaction model — covers every type: DEPOSIT, WITHDRAWAL, LOAN_DISBURSEMENT,
// LOAN_REPAYMENT, FLOAT_*, FEE, TRANSFER, SHARES_PURCHASE, etc.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const transactions = await db.transaction.findMany({
      where: {
        transactionDate: { gte: start, lte: end },
        status: { in: ["COMPLETED", "APPROVED", "REVERSED"] },
      },
      include: {
        account: {
          include: {
            member: { include: { user: { select: { name: true } } } },
            institution: { select: { institutionName: true } },
            accountType: { select: { name: true } },
            branch: { select: { name: true } },
          },
        },
        processedByUser: { select: { name: true, role: true } },
      },
      orderBy: [{ transactionDate: "asc" }],
    });

    const records = transactions.map((txn, index) => ({
      id: txn.id,
      sequence: index + 1,
      transactionRef: txn.transactionRef,
      transactionDate: txn.transactionDate.toISOString(),
      createdAt: txn.transactionDate.toISOString(),
      memberName: txn.account?.member?.user?.name || txn.account?.institution?.institutionName || "N/A",
      accountNumber: txn.account?.accountNumber || "N/A",
      accountType: txn.account?.accountType?.name || "N/A",
      type: txn.type,
      transactionType: txn.type,
      amount: Number(txn.amount),
      status: txn.status,
      processedBy: txn.processedByUser?.name || "System",
      teller: { name: txn.processedByUser?.name || "System" },
      branch: { name: txn.account?.branch?.name || "Head Office" },
      processedByRole: txn.processedByUser?.role || "SYSTEM",
      channel: txn.channel || "N/A",
      description: txn.description || "",
    }));

    const totalDeposits = records
      .filter((r) => r.type === "DEPOSIT" || r.type === "SHARES_PURCHASE")
      .reduce((sum, r) => sum + r.amount, 0);

    const totalWithdrawals = records
      .filter((r) => r.type === "WITHDRAWAL")
      .reduce((sum, r) => sum + r.amount, 0);

    const summary = {
      count: records.length,
      totalAmount: records.reduce((sum, r) => sum + r.amount, 0),
      totalDeposits,
      totalWithdrawals,
      netFlow: totalDeposits - totalWithdrawals,
      byType: records.reduce(
        (acc: Record<string, number>, r) => {
          acc[r.type] = (acc[r.type] || 0) + 1;
          return acc;
        },
        {},
      ),
      byStatus: records.reduce(
        (acc: Record<string, number>, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        },
        {},
      ),
    };

    return NextResponse.json({ data: records, summary });
  } catch (error) {
    console.error("Error generating transaction sequence report:", error);
    return NextResponse.json(
      { error: "Failed to generate transaction sequence report" },
      { status: 500 },
    );
  }
}
