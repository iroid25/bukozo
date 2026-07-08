import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { AccountStatus, TransactionStatus, TransactionType, UserRole } from "@prisma/client";

import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { isVoluntarySavingsAccountTypeName } from "@/lib/accounting/account-type-rules";
import { createMemberDepositJournalEntry, createWithdrawalFeeJournalEntry } from "@/lib/journal-entries-extended";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";
import {
  DORMANCY_REACTIVATION_MIN_BALANCE,
  DORMANCY_REACTIVATION_PENALTY,
  generateDormancyReference,
} from "@/lib/services/savings-dormancy";
import {
  DORMANCY_PENALTY_CODE,
  DORMANCY_PENALTY_NAME,
  FEE_INCOME_CODE,
} from "@/lib/services/income-structure";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = String((session.user as any)?.role || "").toUpperCase();
    if (!["ADMIN", "ACCOUNTANT", "TELLER"].includes(role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const { accountId } = await params;
    const body = await request.json().catch(() => ({}));
    const collectedByUserId =
      typeof body.collectedByUserId === "string" && body.collectedByUserId.trim()
        ? body.collectedByUserId.trim()
        : String((session.user as any)?.id || "");
    if (!collectedByUserId) {
      return NextResponse.json({ error: "Unable to resolve collecting user" }, { status: 400 });
    }
    const reference = typeof body.reference === "string" && body.reference.trim()
      ? body.reference.trim()
      : generateDormancyReference("REACT");
    const remarks = typeof body.remarks === "string" ? body.remarks.trim() : "";

    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        accountType: {
          include: {
            ledgerAccount: {
              select: {
                accountCode: true,
              },
            },
          },
        },
        member: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        institution: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (!isVoluntarySavingsAccountTypeName(account.accountType.name)) {
      return NextResponse.json(
        { error: "This account type cannot be reactivated through the dormancy flow" },
        { status: 400 },
      );
    }

    if (account.status !== AccountStatus.DORMANT) {
      return NextResponse.json({ error: "Account is not dormant" }, { status: 400 });
    }

    const restorationAmount = Math.max(
      0,
      DORMANCY_REACTIVATION_MIN_BALANCE - Number(account.balance || 0),
    );
    const penaltyAmount = DORMANCY_REACTIVATION_PENALTY;
    const totalCollected = restorationAmount + penaltyAmount;

    const result = await db.$transaction(async (tx) => {
      const feeIncomeParent = await tx.budgetCategory.upsert({
        where: { code: FEE_INCOME_CODE },
        update: {
          name: "Fee income",
          kind: "INCOME",
          description: "Income from service and transaction fees",
          isActive: true,
        },
        create: {
          name: "Fee income",
          code: FEE_INCOME_CODE,
          kind: "INCOME",
          description: "Income from service and transaction fees",
          isActive: true,
        },
      });

      const dormancyPenaltyCategory = await tx.budgetCategory.upsert({
        where: { code: DORMANCY_PENALTY_CODE },
        update: {
          name: DORMANCY_PENALTY_NAME,
          kind: "INCOME",
          description: "Penalties charged when dormant accounts are reactivated",
          isActive: true,
          parentId: feeIncomeParent.id,
        },
        create: {
          name: DORMANCY_PENALTY_NAME,
          code: DORMANCY_PENALTY_CODE,
          kind: "INCOME",
          description: "Penalties charged when dormant accounts are reactivated",
          isActive: true,
          parentId: feeIncomeParent.id,
        },
      });

      await tx.chartOfAccount.upsert({
        where: { accountCode: DORMANCY_PENALTY_CODE },
        update: {
          accountName: DORMANCY_PENALTY_NAME,
          fullCode: DORMANCY_PENALTY_CODE,
          ledgerType: "INCOME",
          debitCredit: "CR",
          isActive: true,
          level: 2,
          category: "INCOME",
          description: "Penalties charged when dormant accounts are reactivated",
        },
        create: {
          accountName: DORMANCY_PENALTY_NAME,
          accountCode: DORMANCY_PENALTY_CODE,
          fullCode: DORMANCY_PENALTY_CODE,
          ledgerType: "INCOME",
          debitCredit: "CR",
          isActive: true,
          level: 2,
          category: "INCOME",
          description: "Penalties charged when dormant accounts are reactivated",
        },
      });

      let restorationTransaction: { id: string } | null = null;

      if (restorationAmount > 0) {
        restorationTransaction = await tx.transaction.create({
          data: {
            transactionRef: `${reference}-DEP`,
            type: TransactionType.DEPOSIT,
            amount: restorationAmount,
            status: TransactionStatus.COMPLETED,
            description: `Dormant account reactivation - minimum balance restoration${remarks ? ` (${remarks})` : ""}`,
            currency: "UGX",
            branchId: account.branchId,
            memberId: account.memberId ?? null,
            accountId: account.id,
            processedByUserId: collectedByUserId,
            channel: "CASH",
          },
        });

        const depositJournal = await createMemberDepositJournalEntry(
          {
            amount: restorationAmount,
            description: `Dormant account reactivation - minimum balance restoration${remarks ? ` (${remarks})` : ""}`,
            reference: `${reference}-DEP`,
            transactionId: restorationTransaction.id,
            userId: collectedByUserId,
            entryDate: new Date(),
            branchId: account.branchId,
          },
          tx,
        );

        if (!depositJournal) {
          throw new Error("Failed to create reactivation deposit journal entry");
        }
      }

      const penaltyTransaction = await tx.transaction.create({
        data: {
          transactionRef: `${reference}-PEN`,
          type: TransactionType.FEE,
          amount: penaltyAmount,
          status: TransactionStatus.COMPLETED,
          description: `Dormant account reactivation penalty${remarks ? ` (${remarks})` : ""}`,
          currency: "UGX",
          branchId: account.branchId,
          memberId: account.memberId ?? null,
          accountId: account.id,
          processedByUserId: collectedByUserId,
          channel: "CASH",
          relatedTransactionId: restorationTransaction?.id || null,
        },
      });

      const feeJournal = await createWithdrawalFeeJournalEntry(
        {
          amount: penaltyAmount,
          description: `Dormant account reactivation penalty${remarks ? ` (${remarks})` : ""}`,
          reference: `${reference}-PEN`,
          transactionId: penaltyTransaction.id,
          userId: collectedByUserId,
          entryDate: new Date(),
          branchId: account.branchId,
          feeAccountCode: DORMANCY_PENALTY_CODE,
          feeAccountName: DORMANCY_PENALTY_NAME,
          debitAccountCode: account.accountType.ledgerAccount?.accountCode,
        },
        tx,
      );

      if (!feeJournal) {
        throw new Error("Failed to create dormancy penalty journal entry");
      }

      const newBalance = DORMANCY_REACTIVATION_MIN_BALANCE;
      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: {
          balance: newBalance,
          status: AccountStatus.ACTIVE,
          closedAt: null,
        },
      });

      await tx.incomeRecord.create({
        data: {
          budgetCategoryId: dormancyPenaltyCategory.id,
          amount: penaltyAmount,
          date: new Date(),
          recordDate: new Date(),
          description: `Dormant account reactivation penalty - ${account.accountNumber}`,
          receivedByUserId: collectedByUserId,
          branchId: account.branchId,
          memberId: account.memberId ?? null,
          accountId: account.id,
          status: TransactionStatus.COMPLETED,
          receiptNumber: `${reference}-PEN`,
          receiptNo: `${reference}-PEN`,
          referenceNumber: `${reference}-PEN`,
          depositorName: account.member?.user?.name || account.accountNumber,
          notes: `Dormant account reactivation penalty${remarks ? ` - ${remarks}` : ""}`,
          externalRef: `${reference}-PEN`,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: collectedByUserId,
          action: "UPDATE",
          entityType: "Account",
          entityId: account.id,
          details: `Dormant account reactivated. Restoration UGX ${restorationAmount.toLocaleString()} and penalty UGX ${penaltyAmount.toLocaleString()} collected.${remarks ? ` Notes: ${remarks}` : ""}`,
        },
      });

      return {
        account: updatedAccount,
        restorationAmount,
        penaltyAmount,
        totalCollected,
        reference,
      };
    });

    await bumpAccountingSyncState();
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/reports/manager");
    revalidatePath("/dashboard/reports/savings");
    revalidatePath("/dashboard/reports/savings/dormant-accounts");
    revalidatePath("/dashboard/reports/savings/savings-listing");
    revalidatePath("/dashboard/reports/savings/savings-performance");

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error reactivating dormant account:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reactivate account",
      },
      { status: 500 },
    );
  }
}
