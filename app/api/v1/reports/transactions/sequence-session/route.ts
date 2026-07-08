import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/v1/reports/transactions/sequence-session?startDate=&endDate=
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Get all transactions ordered by date and sequence
    const transactions = await db.transaction.findMany({
      where: {
        transactionDate: {
          gte: start,
          lte: end,
        },
        status: {
          in: ['COMPLETED', 'APPROVED', 'REVERSED'],
        },
      },
      include: {
        account: {
          include: {
            member: { include: { user: { select: { name: true } } } },
            institution: { select: { institutionName: true } },
            branch: { select: { name: true } },
          },
        },
        processedByUser: { select: { name: true } },
      },
      orderBy: [
        { transactionDate: "asc" },
      ],
    });

    const records = transactions.map((txn, index) => {
      const dateStr = txn.transactionDate.toISOString().split("T")[0];
      const virtualSessionId = `SESS-${dateStr}-${txn.processedByUserId || "SYSTEM"}`;
      
      return {
        id: txn.id,
        sequence: index + 1,
        transactionRef: txn.transactionRef || `TXN-${index.toString().padStart(6, '0')}`,
        sessionId: virtualSessionId,
        sessionDate: dateStr,
        transactionDate: txn.transactionDate.toISOString(),
        createdAt: txn.transactionDate.toISOString(), // fallback
        memberName: txn.account?.member?.user?.name || txn.account?.institution?.institutionName || "N/A",
        accountNumber: txn.account?.accountNumber || "N/A",
        type: txn.type,
        transactionType: txn.type, // Alias for frontend compatibility
        amount: Number(txn.amount),
        status: txn.status,
        processedBy: txn.processedByUser?.name || "System",
        teller: { name: txn.processedByUser?.name || "System" }, // Alias for frontend
        branch: { name: txn.account?.branch?.name || "Head Office" }, // Alias for frontend
        description: txn.description || "",
      };
    });

    const totalDeposits = records
        .filter(r => r.type === 'DEPOSIT' || r.type === 'SHARES_PURCHASE')
        .reduce((sum, r) => sum + r.amount, 0);

    const totalWithdrawals = records
        .filter(r => r.type === 'WITHDRAWAL')
        .reduce((sum, r) => sum + r.amount, 0);

    const summary = {
      count: records.length,
      totalAmount: records.reduce((sum, r) => sum + r.amount, 0),
      totalDeposits,
      totalWithdrawals,
      netFlow: totalDeposits - totalWithdrawals,
      byType: records.reduce((acc: any, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {}),
    };

    return NextResponse.json({
      data: records,
      summary,
    });
  } catch (error) {
    console.error("Error generating transaction sequence report:", error);
    return NextResponse.json(
      { error: "Failed to generate transaction sequence report" },
      { status: 500 }
    );
  }
}
