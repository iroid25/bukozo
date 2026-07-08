import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/v1/reports/transactions/journal-transaction?startDate=&endDate=
// Journal listing filtered and ordered by the TRANSACTION date (value date).
// For entries linked to a Transaction, the filter is applied on Transaction.transactionDate.
// For manual (unlinked) journal entries, the filter falls back to entryDate.
// Source: JournalEntry → Transaction → Member → User
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

    // Filter by transaction.transactionDate for linked entries;
    // fall back to entryDate for manual (unlinked) journal entries.
    const journalEntries = await db.journalEntry.findMany({
      where: {
        OR: [
          {
            transaction: {
              transactionDate: { gte: start, lte: end },
            },
          },
          {
            transactionId: null,
            entryDate: { gte: start, lte: end },
          },
        ],
      },
      include: {
        account: {
          select: {
            accountCode: true,
            accountName: true,
            ledgerType: true,
          },
        },
        transaction: {
          select: {
            transactionRef: true,
            type: true,
            transactionDate: true,
            member: {
              include: { user: { select: { name: true } } },
            },
            institution: { select: { institutionName: true } },
          },
        },
        createdBy: {
          select: { name: true },
        },
      },
      orderBy: [
        { transaction: { transactionDate: "asc" } },
        { entryNumber: "asc" },
      ],
    });

    const records = journalEntries.map((entry) => ({
      entryNumber: entry.entryNumber,
      transactionRef:
        entry.transaction?.transactionRef || entry.reference || "",
      transactionDate:
        entry.transaction?.transactionDate?.toISOString() ||
        entry.entryDate.toISOString(),
      entryDate: entry.entryDate.toISOString().split("T")[0],
      accountCode: entry.account.accountCode,
      accountName: entry.account.accountName,
      ledgerType: entry.account.ledgerType,
      debitAmount: Number(entry.debitAmount),
      creditAmount: Number(entry.creditAmount),
      description: entry.description,
      memberName: entry.transaction?.member?.user?.name || entry.transaction?.institution?.institutionName || "N/A",
      transactionType: entry.transaction?.type || "MANUAL",
      createdBy: entry.createdBy.name,
    }));

    const summary = {
      totalEntries: records.length,
      totalDebits: records.reduce((sum, r) => sum + r.debitAmount, 0),
      totalCredits: records.reduce((sum, r) => sum + r.creditAmount, 0),
      byTransactionType: records.reduce(
        (
          acc: Record<string, { count: number; debits: number; credits: number }>,
          r,
        ) => {
          if (!acc[r.transactionType]) {
            acc[r.transactionType] = { count: 0, debits: 0, credits: 0 };
          }
          acc[r.transactionType].count++;
          acc[r.transactionType].debits += r.debitAmount;
          acc[r.transactionType].credits += r.creditAmount;
          return acc;
        },
        {},
      ),
    };

    return NextResponse.json({ data: records, summary });
  } catch (error) {
    console.error("Error generating journal listing report:", error);
    return NextResponse.json(
      { error: "Failed to generate journal listing report" },
      { status: 500 },
    );
  }
}
