import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

// POST /api/v1/journal-entries/auto/expenditure - Create journal entry for expenditure
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

    // Find the appropriate expense account (5 - EXPENSES)
    const expenseAccount = await db.chartOfAccount.findFirst({
      where: {
        ledgerType: "EXPENDITURES",
        isActive: true,
      },
    });

    // Find the cash/bank account
    const cashAccount = await db.chartOfAccount.findFirst({
      where: {
        accountCode: "102001", // CASH AT HAND
        isActive: true,
      },
    });

    if (!expenseAccount || !cashAccount) {
      return NextResponse.json(
        { error: "Required accounts not found in Chart of Accounts" },
        { status: 404 }
      );
    }

    const entryNumber = `JE-EXP-${Date.now()}`;

    // Create journal entries (Debit Expense, Credit Cash)
    const result = await db.$transaction([
      // Debit: Expense (Expense increases)
      db.journalEntry.create({
        data: {
          entryNumber,
          accountId: expenseAccount.id,
          debitAmount: body.amount,
          creditAmount: 0,
          description: body.description,
          reference: body.reference || null,
          transactionId: body.transactionId || null,
          createdByUserId: (session.user as any).id,
        },
      }),
      // Credit: Cash/Bank (Asset decreases)
      db.journalEntry.create({
        data: {
          entryNumber,
          accountId: cashAccount.id,
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
        where: { id: expenseAccount.id },
        data: {
          debitBalance: { increment: body.amount },
          balance: { increment: body.amount },
        },
      }),
      db.chartOfAccount.update({
        where: { id: cashAccount.id },
        data: {
          creditBalance: { increment: body.amount },
          balance: { decrement: body.amount },
        },
      }),
    ]);

    return NextResponse.json(
      {
        data: {
          entryNumber,
          entries: result.slice(0, 2), // Return the journal entries
        },
        message: "Expenditure journal entry created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating expenditure journal entry:", error);
    return NextResponse.json(
      { error: "Failed to create journal entry" },
      { status: 500 }
    );
  }
}
