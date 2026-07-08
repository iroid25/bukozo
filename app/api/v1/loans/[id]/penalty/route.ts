import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { LoanService } from "@/services/loan.service";
import { db } from "@/prisma/db";
import { LoanStatus } from "@prisma/client";
import { createLoanPenaltyAccrualJournalEntry } from "@/lib/journal-entries";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { amount, reason, mode } = body;

    // Mode 'policy' or no amount provided means use the compounding calculation
    if (mode === "policy" || !amount) {
      // First try regular loan
      let result = await LoanService.applyManualPenalty(id, user.id);

      if (!result.ok && (result as any).error === "Loan not found") {
        // Try institution loan
        result = await LoanService.applyInstitutionManualPenalty(id, user.id);
      }

      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: (result as any).error },
          { status: 400 },
        );
      }
      return NextResponse.json({ success: true, data: result });
    }

    // Manual penalty mode - apply custom amount
    if (mode === "manual" && amount > 0) {
      // Find the loan
      let loan = await db.loan.findUnique({ where: { id } });
      let isInstitution = false;

      if (!loan) {
        // Try institution loan
        loan = (await db.institutionLoan.findUnique({ where: { id } })) as any;
        isInstitution = true;
      }

      if (!loan) {
        return NextResponse.json(
          { success: false, error: "Loan not found" },
          { status: 404 },
        );
      }

      // Create penalty record and update loan
      const result = await db.$transaction(async (tx) => {
        // Get budget category
        const loanParentCategory = await tx.budgetCategory.upsert({
          where: { code: "401000" },
          update: { name: "Loan related income" },
          create: {
            name: "Loan related income",
            code: "401000",
            kind: "INCOME",
            description:
              "Loan related income including fees, interest and penalties",
            isActive: true,
          },
        });

        const penaltyCategory = await tx.budgetCategory.upsert({
          where: { code: "401005" },
          update: {
            parentId: loanParentCategory.id,
            name: "Loan penalty paid",
            kind: "INCOME",
          },
          create: {
            name: "Loan penalty paid",
            code: "401005",
            kind: "INCOME",
            description: "Penalties charged on overdue loans",
            isActive: true,
            parentId: loanParentCategory.id,
          },
        });

        // Income record for operational reporting
        await tx.incomeRecord.create({
          data: {
            budgetCategoryId: penaltyCategory.id,
            amount: amount,
            date: new Date(),
            description: `Manual Penalty - Loan ${id.slice(0, 8)} - ${reason || "Manual entry"}`,
            paymentMethod: "OTHER",
            receivedByUserId: user.id,
            status: "COMPLETED",
            recordDate: new Date(),
          },
        });

        // Double-entry GL for penalty accrual
        await createLoanPenaltyAccrualJournalEntry(
          {
            amount: amount,
            description: `Manual Penalty - Loan ${id.slice(0, 8)} - ${reason || "Manual entry"}`,
            userId: user.id,
            reference: `PEN-MAN-${Date.now()}`,
            entryDate: new Date(),
            branchId: loan.branchId ?? undefined,
          },
          tx,
        );

        // Update loan
        await tx.loan.update({
          where: { id },
          data: {
            penaltyCharged: { increment: amount },
            outstandingBalance: { increment: amount },
            lastPenaltyAppliedAt: new Date(),
            status: LoanStatus.OVERDUE,
          },
        });

        // Create ledger transaction
        const lastLedger = await tx.loanLedgerTransaction.findFirst({
          where: { loanId: id },
          orderBy: { transactionDate: "desc" },
        });

        await tx.loanLedgerTransaction.create({
          data: {
            loanId: id,
            transactionType: "PENALTY",
            transactionDate: new Date(),
            voucherNo: `PEN-MAN-${Date.now()}`,
            debitPrincipal: 0,
            debitInterest: amount,
            creditPrincipal: 0,
            creditInterest: 0,
            balancePrincipal:
              lastLedger?.balancePrincipal ?? loan.amountGranted,
            balanceInterest: (lastLedger?.balanceInterest ?? 0) + amount,
            balanceTotal: (lastLedger?.balanceTotal ?? 0) + amount,
          },
        });

        return {
          ok: true,
          amount,
          message: "Manual penalty applied successfully",
        };
      });

      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, error: "Invalid mode or amount" },
      { status: 400 },
    );
  } catch (error: any) {
    console.error("Penalty Application API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to apply penalty",
      },
      { status: 500 },
    );
  }
}
