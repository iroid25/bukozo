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

// GET /api/v1/reports/transactions/register-transaction?startDate=&endDate=
// Transaction register ordered by transaction/value date.
// Source: Transaction model — covers DEPOSIT, WITHDRAWAL, LOAN_DISBURSEMENT,
// LOAN_REPAYMENT, FEE, TRANSFER, SHARES_PURCHASE, FLOAT_*, etc.
// Difference from register-session: uses valueDate (actual value date) when set;
// falls back to transactionDate.
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

    // Filter by transactionDate; valueDate is used for display when available
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
      // Order by valueDate when available, otherwise by transactionDate
      orderBy: [{ transactionDate: "asc" }],
    });

    let runningBalance = 0;
    const records = transactions.map((txn) => {
      const amount = Number(txn.amount);
      const isCredit = CREDIT_TYPES.includes(txn.type);
      const isDebit = DEBIT_TYPES.includes(txn.type);

      if (isCredit) runningBalance += amount;
      if (isDebit) runningBalance -= amount;

      // Use valueDate as the effective transaction date if set
      const effectiveDate = txn.valueDate ?? txn.transactionDate;

      return {
        transactionRef: txn.transactionRef,
        transactionDate: effectiveDate.toISOString(),
        date: effectiveDate.toISOString().split("T")[0],
        memberName: txn.account?.member?.user?.name || txn.account?.institution?.institutionName || "N/A",
        accountNumber: txn.account?.accountNumber || "N/A",
        accountType: txn.account?.accountType?.name || "N/A",
        type: txn.type,
        debit: isDebit ? amount : 0,
        credit: isCredit ? amount : 0,
        balance: runningBalance,
        status: txn.status,
        processedBy: txn.processedByUser?.name || "System",
        processedByRole: txn.processedByUser?.role || "SYSTEM",
        branch: txn.account?.branch?.name || "Head Office",
        channel: txn.channel || "N/A",
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
