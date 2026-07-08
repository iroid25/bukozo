// app/api/v1/accountant/expenditure/[id]/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, TransactionStatus, TransactionType } from "@prisma/client";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";
import { CASH_AT_HAND_CODE } from "@/lib/services/asset-structure";

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check permissions
    const allowedRoles: UserRole[] = [
      UserRole.ACCOUNTANT,
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "You don't have permission to approve expenditures",
        },
        { status: 403 }
      );
    }

    // ✅ Await params in Next.js 15
    const params = await props.params;
    const { id } = params;

    const body = await request.json();
    const { notes } = body;

    // Find the expenditure record
    const expenditure = await db.expenditureRecord.findUnique({
      where: { id },
      include: {
        budgetCategory: true,
        submittedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!expenditure) {
      return NextResponse.json(
        { success: false, error: "Expenditure record not found" },
        { status: 404 }
      );
    }

    if (expenditure.status !== TransactionStatus.PENDING) {
      return NextResponse.json(
        {
          success: false,
          error: `Expenditure has already been ${expenditure.status.toLowerCase()}`,
        },
        { status: 400 }
      );
    }

    let updatedExpenditure: any;

    await db.$transaction(async (tx) => {
      updatedExpenditure = await tx.expenditureRecord.update({
        where: { id },
        data: {
          status: TransactionStatus.COMPLETED,
          approvedByUserId: user.id,
          approvedAt: new Date(),
          notes: notes || expenditure.notes,
        },
        include: {
          budgetCategory: true,
          approvedBy: { select: { name: true } },
        },
      });

      // Decrement the submitter's float
      const float = await tx.userFloat.findUnique({
        where: { userId: expenditure.submittedByUserId },
      });
      if (float) {
        await tx.userFloat.update({
          where: { id: float.id },
          data: { balance: { decrement: updatedExpenditure.amount } },
        });
        await tx.floatTransaction.create({
          data: {
            floatId: float.id,
            type: TransactionType.OTHER,
            amount: -updatedExpenditure.amount,
            description: `Expenditure: ${updatedExpenditure.description || updatedExpenditure.budgetCategory?.name}`,
            performedByUserId: user.id,
            relatedTransactionId: updatedExpenditure.id,
          },
        });
      }

      // Double-entry GL: Dr Expense Account, Cr Cash Account
      const cat = updatedExpenditure.budgetCategory;
      const expenseAccount = cat?.code
        ? await tx.chartOfAccount.findFirst({ where: { accountCode: cat.code, isActive: true } })
        : null;
      const assetAccount = await tx.chartOfAccount.findFirst({
        where: { accountCode: CASH_AT_HAND_CODE, isActive: true },
      });

      if (expenseAccount && assetAccount) {
        const entryNumber = `JE-EXP-${Date.now()}`;
        await tx.journalEntry.create({
          data: {
            entryNumber, accountId: expenseAccount.id, debitAmount: updatedExpenditure.amount, creditAmount: 0,
            description: `Expenditure: ${updatedExpenditure.description || cat?.name}`,
            entryDate: new Date(), reference: `EXP-${id.slice(0, 8)}`,
            branchId: updatedExpenditure.branchId || undefined,
            transactionId: updatedExpenditure.id, createdByUserId: user.id,
          },
        });
        await tx.journalEntry.create({
          data: {
            entryNumber, accountId: assetAccount.id, debitAmount: 0, creditAmount: updatedExpenditure.amount,
            description: `Expenditure: ${updatedExpenditure.description || cat?.name}`,
            entryDate: new Date(), reference: `EXP-${id.slice(0, 8)}`,
            branchId: updatedExpenditure.branchId || undefined,
            transactionId: updatedExpenditure.id, createdByUserId: user.id,
          },
        });
        await tx.chartOfAccount.update({
          where: { id: expenseAccount.id },
          data: buildAccountBalanceUpdate(expenseAccount, { debitAmount: updatedExpenditure.amount }),
        });
        await tx.chartOfAccount.update({
          where: { id: assetAccount.id },
          data: buildAccountBalanceUpdate(assetAccount, { creditAmount: updatedExpenditure.amount }),
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: user.id, action: "APPROVE_EXPENDITURE",
          entityType: "ExpenditureRecord", entityId: id,
          oldValue: { status: expenditure.status },
          newValue: { status: TransactionStatus.COMPLETED },
          details: `Approved expenditure of UGX ${expenditure.amount.toLocaleString()} for ${cat?.name || "Unknown"}`,
          timestamp: new Date(),
        },
      });

      // Notification for submitter
      await tx.notification.create({
        data: {
          userId: expenditure.submittedByUserId, type: "IN_APP",
          subject: "Expenditure Approved",
          message: `Your expenditure request for UGX ${expenditure.amount.toLocaleString()} (${cat?.name || "Unknown"}) has been approved by ${user.name}`,
          targetAddress: "/dashboard/expenditure",
          sentAt: new Date(), isRead: false, status: "SENT",
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Expenditure approved successfully",
      data: updatedExpenditure,
    });
  } catch (error) {
    console.error("Error approving expenditure:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to approve expenditure",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
