import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

// POST /api/v1/journal-entries/auto/income - Create journal entry for income
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.amount || !body.description) {
      return NextResponse.json(
        { error: "Amount and description are required" },
        { status: 400 }
      );
    }

    // Find the appropriate income account (4 - INCOME)
    const incomeAccount = await db.chartOfAccount.findFirst({
      where: {
        ledgerType: "INCOME",
        isActive: true,
      },
    });

    // Find the cash/bank account (1 - ASSETS)
    const cashAccount = await db.chartOfAccount.findFirst({
      where: {
        accountCode: "102001", // CASH AT HAND
        isActive: true,
      },
    });

    if (!incomeAccount || !cashAccount) {
      return NextResponse.json(
        { error: "Required accounts not found in Chart of Accounts" },
        { status: 404 }
      );
    }

    const entryNumber = `JE-INC-${Date.now()}`;

    // Create journal entries (Debit Cash, Credit Income)
    const result = await db.$transaction([
      // Debit: Cash/Bank (Asset increases)
      db.journalEntry.create({
        data: {
          entryNumber,
          accountId: cashAccount.id,
          debitAmount: body.amount,
          creditAmount: 0,
          description: body.description,
          reference: body.reference || null,
          transactionId: body.transactionId || null,
          createdByUserId: (session.user as any).id,
        },
      }),
      // Credit: Income (Income increases)
      db.journalEntry.create({
        data: {
          entryNumber,
          accountId: incomeAccount.id,
          debitAmount: 0,
          creditAmount: body.amount,
          description: body.description,
          reference: body.reference || null,
          transactionId: body.transactionId || null,
          createdByUserId: (session.user as any).id,
        },
      }),
      // Update account balances
      db.chartOfAccount.update({
        where: { id: cashAccount.id },
        data: {
          debitBalance: { increment: body.amount },
          balance: { increment: body.amount },
        },
      }),
      db.chartOfAccount.update({
        where: { id: incomeAccount.id },
        data: {
          creditBalance: { increment: body.amount },
          balance: { increment: body.amount },
        },
      }),
    ]);

    return NextResponse.json(
      {
        data: {
          entryNumber,
          entries: result.slice(0, 2), // Return the journal entries
        },
        message: "Income journal entry created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating income journal entry:", error);
    return NextResponse.json(
      { error: "Failed to create journal entry" },
      { status: 500 }
    );
  }
}
