import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { PaymentMethod, RecognitionBasis, TransactionStatus, UserRole, VaultTransactionType, Prisma, TransactionType } from "@prisma/client";

import { successResponse, ApiErrors } from "@/lib/api-utils";
import { IncomeService } from "@/services/income.service";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { reverseJournalEntriesForRecord } from "@/lib/journal-entries-extended";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";
import { CASH_AT_HAND_CODE } from "@/lib/services/asset-structure";

// Helpful for type safety
type AppUser = { id: string; role: string; branchId: string | null };
// Helper: Get current open financial period
async function getCurrentOpenPeriod() {
  return db.financialPeriod.findFirst({
    where: {
      isClosed: false,
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
  });
}


// GET /api/v1/income - List all income records or fetch single by ID
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as AppUser;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const requestedBranchId = searchParams.get("branchId");
    const branchId = resolveBranchScope(user, requestedBranchId);

    if (id) {
      const incomeRecord = await db.incomeRecord.findFirst({
        where: {
          id,
          ...(await IncomeService.getBranchFilter(user, branchId)),
          budgetCategory: {
            kind: "INCOME" as const,
            name: {
              notIn: ["loan insurance fees", "loan share capital"],
              mode: "insensitive" as const,
            },
          },
        },
        include: {
          budgetCategory: { include: { parent: true } },
          branch: true,
          member: { include: { user: true } },
          account: { include: { accountType: true } },
          receivedBy: { select: { id: true, name: true, role: true } },
          period: true,
        },
      });
      if (!incomeRecord) return NextResponse.json({ error: "Income record not found" }, { status: 404 });
      return successResponse(incomeRecord);
    }

    const incomeRecords = await IncomeService.getUnifiedIncomeRecords({
      user,
      branchId,
    });

    return successResponse(incomeRecords);
  } catch (error) {
    console.error("Error fetching income records:", error);
    return NextResponse.json(
      { error: "Failed to fetch income records" },
      { status: 500 }
    );
  }
}

// POST /api/v1/income - Create new income record
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await request.json();

    const result = await IncomeService.createIncomeRecord(body, user);

    void bumpAccountingSyncState("Income record created");
    return successResponse(result, "Income record created successfully", 201);
  } catch (error: any) {
    console.error("Error creating income record:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create income record" },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/income - Update income record
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as AppUser;
    const body = await request.json();
    const { id, ...data } = body;

    const branchFilter = await IncomeService.getBranchFilter(user);
    const existingRecord = await IncomeService.getIncomeRecordById(id, branchFilter);

    if (!existingRecord) {
      return NextResponse.json({ error: "Income record not found" }, { status: 404 });
    }

    // Only allow updates within 24 hours for non-admins
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNTANT) {
      const hoursSinceRecord = (Date.now() - existingRecord.recordDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceRecord > 24) {
        return NextResponse.json({ error: "Can only update records within 24 hours" }, { status: 403 });
      }
    }

    const updatedRecord = await db.$transaction(async (tx) => {
      // 1. Reverse old journal entries if the record was COMPLETED
      if (existingRecord.status === TransactionStatus.COMPLETED) {
        await reverseJournalEntriesForRecord(
          id,
          user.id,
          `Income update - ${existingRecord.description || id}`,
          tx,
          existingRecord.recordDate ?? undefined,
          existingRecord.branchId ?? undefined,
        );
      }

      // 2. Update the record
      const record = await tx.incomeRecord.update({
        where: { id },
        data: {
          budgetCategoryId: data.categoryId,
          amount: data.amount,
          description: data.description,
          paymentMethod: data.paymentMethod,
          receiptNo: data.receiptNo,
          status: data.status,
          depositorName: data.depositorName,
          depositorContact: data.depositorContact,
          notes: data.notes,
        },
      });

      // 3. Re-create journal entries if the record is COMPLETED
      if (record.status === TransactionStatus.COMPLETED) {
        const category = data.categoryId
          ? await tx.budgetCategory.findUnique({ where: { id: data.categoryId } })
          : existingRecord.budgetCategory;
        const categoryCode = category?.code;
        if (categoryCode) {
          const incomeAccount = await tx.chartOfAccount.findFirst({
            where: { accountCode: categoryCode, isActive: true },
          });
          if (incomeAccount) {
            const paymentMethod = data.paymentMethod || existingRecord.paymentMethod;
            const assetCode = paymentMethod === PaymentMethod.CASH ? CASH_AT_HAND_CODE : "102001";
            const assetAccount = await tx.chartOfAccount.findFirst({
              where: { accountCode: assetCode, isActive: true },
            });
            if (assetAccount) {
              const entryNumber = `JE-INC-${Date.now()}`;
              await tx.journalEntry.create({
                data: {
                  entryNumber,
                  accountId: assetAccount.id,
                  debitAmount: record.amount,
                  creditAmount: 0,
                  description: `Income: ${record.description || record.receiptNo}`,
                  entryDate: new Date(),
                  reference: `INC-${record.id.slice(0, 8)}`,
                  branchId: record.branchId || undefined,
                  transactionId: record.id,
                  createdByUserId: user.id,
                },
              });
              await tx.journalEntry.create({
                data: {
                  entryNumber,
                  accountId: incomeAccount.id,
                  debitAmount: 0,
                  creditAmount: record.amount,
                  description: `Income: ${record.description || record.receiptNo}`,
                  entryDate: new Date(),
                  reference: `INC-${record.id.slice(0, 8)}`,
                  branchId: record.branchId || undefined,
                  transactionId: record.id,
                  createdByUserId: user.id,
                },
              });
              await tx.chartOfAccount.update({
                where: { id: assetAccount.id },
                data: buildAccountBalanceUpdate(assetAccount, { debitAmount: record.amount }),
              });
              await tx.chartOfAccount.update({
                where: { id: incomeAccount.id },
                data: buildAccountBalanceUpdate(incomeAccount, { creditAmount: record.amount }),
              });
            }
          }
        }
      }

      return record;
    });

    void bumpAccountingSyncState("Income record updated");
    return successResponse(updatedRecord, "Income record updated successfully");
  } catch (error) {
    console.error("Error updating income record:", error);
    return NextResponse.json({ error: "Failed to update income record" }, { status: 500 });
  }
}

// DELETE /api/v1/income - Delete income record
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as AppUser;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    const branchFilter = await IncomeService.getBranchFilter(user);
    const existingRecord = await IncomeService.getIncomeRecordById(id, branchFilter);

    if (!existingRecord) {
      return NextResponse.json({ error: "Income record not found" }, { status: 404 });
    }

    if (user.role !== UserRole.ADMIN) {
      const hoursSinceRecord = (Date.now() - existingRecord.recordDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceRecord > 24) {
        return NextResponse.json({ error: "Can only delete records within 24 hours" }, { status: 403 });
      }
    }

    await db.$transaction(async (tx) => {
      await reverseJournalEntriesForRecord(id, user.id, `Income deletion - ${existingRecord.description || id}`, tx, existingRecord.recordDate ?? undefined, existingRecord.branchId ?? undefined);
      await tx.incomeRecord.delete({ where: { id } });
    });

    void bumpAccountingSyncState("Income record deleted");
    return successResponse(null, "Income record deleted successfully");
  } catch (error) {
    console.error("Error deleting income record:", error);
    return NextResponse.json({ error: "Failed to delete income record" }, { status: 500 });
  }
}
