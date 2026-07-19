import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Credit transaction types (money flowing INTO accounts)
const CREDIT_TYPES = ["DEPOSIT", "LOAN_DISBURSEMENT", "TRANSFER"];

// Debit transaction types (money flowing OUT of accounts)
const DEBIT_TYPES = [
  "WITHDRAWAL",
  "LOAN_REPAYMENT",
  "FEE",
  "FLOAT_PURCHASE",
  "FLOAT_RECONCILIATION",
  "SHARES_PURCHASE",
  "INSURANCE_PREMIUM",
  "LOAN_FEE",
];

// GET /api/v1/reports/transactions/register-session?startDate=&endDate=
// Transaction register grouped/ordered by session date (transactionDate = posting date).
// Source: Transaction model — covers DEPOSIT, WITHDRAWAL, LOAN_DISBURSEMENT,
// LOAN_REPAYMENT, FEE, TRANSFER, SHARES_PURCHASE, FLOAT_*, etc.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const typeFilter = searchParams.get("type");

    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const whereClause: any = {
      transactionDate: { gte: start, lte: end },
      status: { in: ["COMPLETED", "APPROVED", "REVERSED"] },
    };
    if (typeFilter) {
      whereClause.type = typeFilter;
    }

    // Filter by transactionDate — this is the session/posting date (defaults to now() on creation)
    const transactions = await db.transaction.findMany({
      where: whereClause,
      include: {
        account: {
          include: {
            member: { include: { user: { select: { name: true } } } },
            institution: { select: { institutionName: true } },
            accountType: { select: { name: true } },
            branch: { select: { name: true } },
          },
        },
        processedByUser: { select: { name: true } },
      },
      orderBy: [{ transactionDate: "asc" }],
    });

    let runningBalance = 0;
    const records = transactions.map((txn) => {
      const amount = Number(txn.amount);
      const isCredit = CREDIT_TYPES.includes(txn.type);
      const isDebit = DEBIT_TYPES.includes(txn.type);

      if (isCredit) runningBalance += amount;
      if (isDebit) runningBalance -= amount;

      return {
        transactionRef: txn.transactionRef,
        date: txn.transactionDate.toISOString().split("T")[0],
        memberName: txn.account?.member?.user?.name || txn.account?.institution?.institutionName || "N/A",
        accountNumber: txn.account?.accountNumber || "N/A",
        accountType: txn.account?.accountType?.name || "N/A",
        type: txn.type,
        debit: isDebit ? amount : 0,
        credit: isCredit ? amount : 0,
        balance: runningBalance,
        status: txn.status,
        processedBy: txn.processedByUser?.name || "System",
        branch: txn.account?.branch?.name || "Head Office",
        description: txn.description || "",
      };
    });

    return NextResponse.json({
      data: records,
      summary: {
        totalTransactions: records.length,
        totalDebits: records.reduce((sum, r) => sum + r.debit, 0),
        totalCredits: records.reduce((sum, r) => sum + r.credit, 0),
        closingBalance: runningBalance,
      },
    });
  } catch (error) {
    console.error("Error generating transaction register:", error);
    return NextResponse.json(
      { error: "Failed to generate transaction register" },
      { status: 500 },
    );
  }
}
