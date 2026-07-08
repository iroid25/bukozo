import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { LoanStatus } from "@prisma/client";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";

export async function DELETE(
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

    const { searchParams } = new URL(request.url);
    const amount = searchParams.get("amount");
    const reason = searchParams.get("reason") || "Manual penalty reversal";

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid reversal amount is required" },
        { status: 400 },
      );
    }

    const reversalAmount = parseFloat(amount);

    // Find the loan
    let loan = await db.loan.findUnique({
      where: { id },
      include: {
        member: { include: { accounts: { where: { status: "ACTIVE" } } } },
      },
    });

    if (!loan) {
      return NextResponse.json(
        { success: false, error: "Loan not found" },
        { status: 404 },
      );
    }

    // Check if there's penalty to reverse
    const currentPenaltyCharged = loan.penaltyCharged || 0;
    const currentPenaltyPaid = loan.penaltyPaid || 0;
    const availableToReverse = currentPenaltyCharged - currentPenaltyPaid;

    if (reversalAmount > availableToReverse) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot reverse more than available penalty. Maximum: ${availableToReverse}`,
        },
        { status: 400 },
      );
    }

    // Process reversal
    const result = await db.$transaction(async (tx) => {
      // 1. Reverse the income record - create a negative income record
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

      // Create reversal income record (negative amount)
      await tx.incomeRecord.create({
        data: {
          budgetCategoryId: penaltyCategory.id,
          amount: -reversalAmount, // Negative to reverse
          date: new Date(),
          description: `PENALTY REVERSAL - Loan ${id.slice(0, 8)} - ${reason}`,
          paymentMethod: "OTHER",
          receivedByUserId: user.id,
          status: "COMPLETED",
          notes: `Reversal: ${reason}`,
          recordDate: new Date(),
        },
      });

      // ── Reversal journal entry (Dr Penalty Income, Cr Loan Receivable) ──
      {
        const [penaltyAccount, loanAccount] = await Promise.all([
          tx.chartOfAccount.findFirst({
            where: { accountCode: "401300", isActive: true },
          }),
          tx.chartOfAccount.findFirst({
            where: { accountCode: { startsWith: "107" }, isActive: true },
          }),
        ]);
        if (penaltyAccount && loanAccount) {
          const revEntryNumber = `JE-PENREV-${Date.now()}`;
          await tx.journalEntry.create({
            data: {
              entryNumber: revEntryNumber,
              accountId: penaltyAccount.id,
              debitAmount: reversalAmount,
              creditAmount: 0,
              description: `Penalty Reversal - Loan ${id.slice(0, 8)} - ${reason}`,
              entryDate: new Date(),
              reference: `PENREV-${id.slice(0, 8)}`,
              branchId: loan.branchId || undefined,
              createdByUserId: user.id,
            },
          });
          await tx.journalEntry.create({
            data: {
              entryNumber: revEntryNumber,
              accountId: loanAccount.id,
              debitAmount: 0,
              creditAmount: reversalAmount,
              description: `Penalty Reversal - Loan ${id.slice(0, 8)} - ${reason}`,
              entryDate: new Date(),
              reference: `PENREV-${id.slice(0, 8)}`,
              branchId: loan.branchId || undefined,
              createdByUserId: user.id,
            },
          });
          await tx.chartOfAccount.update({
            where: { id: penaltyAccount.id },
            data: buildAccountBalanceUpdate(penaltyAccount, { debitAmount: reversalAmount }),
          });
          await tx.chartOfAccount.update({
            where: { id: loanAccount.id },
            data: buildAccountBalanceUpdate(loanAccount, { creditAmount: reversalAmount }),
          });
        }
      }

      // 2. Refund to member account (if they paid any penalty)
      const memberAccount = loan.member?.accounts[0];
      if (memberAccount) {
        await tx.account.update({
          where: { id: memberAccount.id },
          data: { balance: { increment: reversalAmount } },
        });

        // Create transaction record for the refund
        await tx.transaction.create({
          data: {
            transactionRef: `PEN-REV-${Date.now()}`,
            accountId: memberAccount.id,
            memberId: loan.memberId,
            type: "DEPOSIT",
            amount: reversalAmount,
            status: "COMPLETED",
            description: `Penalty Reversal Refund - Loan ${id.slice(0, 8)}`,
            processedByUserId: user.id,
            branchId: loan.branchId,
          },
        });
      }

      // 3. Update loan penalty and balance
      const updatedLoan = await tx.loan.update({
        where: { id },
        data: {
          penaltyCharged: { decrement: reversalAmount },
          outstandingBalance: { decrement: reversalAmount },
        },
      });

      // 4. Create ledger transaction for reversal
      const lastLedger = await tx.loanLedgerTransaction.findFirst({
        where: { loanId: id },
        orderBy: { transactionDate: "desc" },
      });

      await tx.loanLedgerTransaction.create({
        data: {
          loanId: id,
          transactionType: "PENALTY_REVERSAL",
          transactionDate: new Date(),
          voucherNo: `PEN-REV-${Date.now()}`,
          debitPrincipal: 0,
          debitInterest: 0,
          creditPrincipal: 0,
          creditInterest: reversalAmount, // Credit to reduce interest balance
          balancePrincipal: lastLedger?.balancePrincipal ?? loan.amountGranted,
          balanceInterest: Math.max(
            0,
            (lastLedger?.balanceInterest ?? 0) - reversalAmount,
          ),
          balanceTotal: Math.max(
            0,
            (lastLedger?.balanceTotal ?? 0) - reversalAmount,
          ),
        },
      });

      // 5. Update loan status if needed
      if (updatedLoan.outstandingBalance <= 0) {
        await tx.loan.update({
          where: { id },
          data: { status: LoanStatus.REPAID },
        });
      }

      return {
        ok: true,
        amount: reversalAmount,
        message: "Penalty reversed successfully",
        refundedTo: memberAccount?.accountNumber || "N/A",
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Penalty Reversal API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to reverse penalty",
      },
      { status: 500 },
    );
  }
}
