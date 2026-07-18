import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/v1/reports/fixed-deposits/statement?fdId=&startDate=&endDate=
// fdId is a FixedDeposit.id (new model).
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fdId = searchParams.get("fdId") || searchParams.get("accountId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!fdId) {
      return NextResponse.json({ error: "fdId is required" }, { status: 400 });
    }

    const start = startDate ? new Date(startDate) : new Date(new Date().setFullYear(new Date().getFullYear() - 1));
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const fd = await db.fixedDeposit.findUnique({
      where: { id: fdId },
      include: {
        member: { include: { user: true } },
        institution: { select: { institutionName: true } },
        branch: { select: { name: true } },
      },
    });

    if (!fd) {
      return NextResponse.json({ error: "Fixed deposit not found" }, { status: 404 });
    }

    // All Transaction records linked to the destination or source account for this FD
    const transactions = await db.transaction.findMany({
      where: {
        transactionRef: { contains: fd.accountNumber.replace(/\D/g, "") || fd.id.slice(-6) },
        transactionDate: { gte: start, lte: end },
      },
      orderBy: { transactionDate: "asc" },
    });

    // Fallback: fetch by memberId/institutionId and date range if ref search returns nothing
    const txnRows = transactions.length > 0
      ? transactions
      : await db.transaction.findMany({
          where: {
            ...(fd.memberId ? { memberId: fd.memberId } : {}),
            ...(fd.institutionId ? { institutionId: fd.institutionId } : {}),
            description: { contains: fd.accountNumber },
            transactionDate: { gte: start, lte: end },
          },
          orderBy: { transactionDate: "asc" },
        });

    let runningBalance = Number(fd.principalAmount);
    const txnRecords = txnRows.map((txn) => {
      const amt = Number(txn.amount);
      const isCredit = txn.amount > 0;
      const debit = isCredit ? 0 : amt;
      const credit = isCredit ? amt : 0;
      runningBalance += credit - debit;
      return {
        date: txn.transactionDate.toISOString().split("T")[0],
        transactionRef: txn.transactionRef,
        description: txn.description || txn.type,
        debit,
        credit,
        balance: runningBalance,
        type: txn.type,
        status: txn.status,
      };
    });

    return NextResponse.json({
      accountInfo: {
        accountNumber: fd.accountNumber,
        memberName: fd.member?.user?.name || fd.institution?.institutionName || "N/A",
        principalAmount: Number(fd.principalAmount),
        maturityAmount: Number(fd.maturityAmount),
        interestRate: Number(fd.interestRate),
        termMonths: fd.termMonths,
        startDate: fd.startDate.toISOString().split("T")[0],
        maturityDate: fd.maturityDate.toISOString().split("T")[0],
        status: fd.status,
        isWithdrawn: fd.isWithdrawn,
        withdrawnDate: fd.withdrawnDate?.toISOString().split("T")[0] || null,
        withdrawnAmount: fd.withdrawnAmount != null ? Number(fd.withdrawnAmount) : null,
        branch: fd.branch?.name || "N/A",
      },
      transactions: txnRecords,
    });
  } catch (error) {
    console.error("Error generating fixed deposit statement:", error);
    return NextResponse.json({ error: "Failed to generate fixed deposit statement" }, { status: 500 });
  }
}
