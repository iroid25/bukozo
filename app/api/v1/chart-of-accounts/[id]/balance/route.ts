import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

// GET /api/v1/chart-of-accounts/[id]/balance - Get account balance with transaction history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Await params in Next.js 15
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Get account
    const account = await db.chartOfAccount.findUnique({
      where: { id },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        fullCode: true,
        ledgerType: true,
        balance: true,
        debitBalance: true,
        creditBalance: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Build date filter
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.entryDate = {};
      if (startDate) {
        dateFilter.entryDate.gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.entryDate.lte = new Date(endDate);
      }
    }

    // Get journal entries
    const journalEntries = await db.journalEntry.findMany({
      where: {
        accountId: id,
        ...dateFilter,
      },
      include: {
        transaction: {
          select: {
            transactionRef: true,
            type: true,
            description: true,
          },
        },
        createdBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        entryDate: "desc",
      },
    });

    // Calculate totals
    const totalDebits = journalEntries.reduce((sum, entry) => sum + entry.debitAmount, 0);
    const totalCredits = journalEntries.reduce((sum, entry) => sum + entry.creditAmount, 0);

    return NextResponse.json({
      data: {
        account,
        balance: {
          current: account.balance,
          debit: account.debitBalance,
          credit: account.creditBalance,
          periodDebits: totalDebits,
          periodCredits: totalCredits,
          periodNet: totalDebits - totalCredits,
        },
        entries: journalEntries,
      },
    });
  } catch (error) {
    console.error("Error fetching account balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch account balance" },
      { status: 500 }
    );
  }
}