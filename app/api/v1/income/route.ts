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

// Helpful for type safety
type AppUser = { id: string; role: string; branchId: string | null };
const BLOCKED_INCOME_CATEGORY_NAMES = ["loan insurance fees", "loan share capital"];

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

    const branchFilter = await IncomeService.getBranchFilter(user, branchId);
    const incomeCategoryFilter = {
      budgetCategory: {
        kind: "INCOME" as const,
        name: {
          notIn: BLOCKED_INCOME_CATEGORY_NAMES,
          mode: "insensitive" as const,
        },
      },
    };

    if (id) {
      const incomeRecord = await db.incomeRecord.findFirst({
        where: {
          id,
          ...branchFilter,
          ...incomeCategoryFilter,
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

    const incomeRecords = await db.incomeRecord.findMany({
      where: {
        ...branchFilter,
        ...incomeCategoryFilter,
      },
      include: {
        budgetCategory: { include: { parent: true } },
        branch: true,
        member: { include: { user: true } },
        account: { include: { accountType: true } },
        receivedBy: { select: { id: true, name: true, role: true } },
        period: true,
      },
      orderBy: { recordDate: "desc" },
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

    const updatedRecord = await db.incomeRecord.update({
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
