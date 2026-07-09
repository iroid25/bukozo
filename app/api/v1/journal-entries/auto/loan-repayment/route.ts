import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { createSplitLoanRepaymentJournalEntry } from "@/lib/journal-entries-extended";

// POST /api/v1/journal-entries/auto/loan-repayment - Create journal entry for loan repayment
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
    const principalAmount = Number(body.principalAmount ?? body.amount ?? 0);
    const interestAmount = Number(body.interestAmount ?? 0);
    const penaltyAmount = Number(body.penaltyAmount ?? 0);

    const result = await createSplitLoanRepaymentJournalEntry({
      principalAmount,
      interestAmount,
      penaltyAmount,
      description: body.description,
      reference: body.reference || undefined,
      transactionId: body.transactionId || undefined,
      userId: (session.user as any).id,
      entryDate: body.entryDate ? new Date(body.entryDate) : undefined,
      branchId: body.branchId || undefined,
      cashAccountCode: body.cashAccountCode || "102001",
      debitAccountCode: body.debitAccountCode || undefined,
      ledgerAccountId: body.ledgerAccountId || undefined,
      interestAccountId: body.interestAccountId || undefined,
      penaltyAccountId: body.penaltyAccountId || undefined,
    });

    return NextResponse.json(
      {
        data: result,
        message: "Loan repayment journal entry created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating loan repayment journal entry:", error);
    return NextResponse.json(
      { error: "Failed to create journal entry" },
      { status: 500 }
    );
  }
}
