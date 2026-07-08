import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { PaymentMethod, TransactionStatus, UserRole } from "@prisma/client";

import { successResponse, ApiErrors } from "@/lib/api-utils";
import { ExpenditureService } from "@/services/expenditure.service";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { reverseJournalEntriesForRecord } from "@/lib/journal-entries-extended";

// Helpful for type safety
type AppUser = { id: string; role: string; branchId: string | null };

// GET /api/v1/expenditure - List all expenditure records or fetch single record by ID
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as AppUser;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const requestedBranchId = searchParams.get("branchId");
    const branchId = resolveBranchScope(user, requestedBranchId);

    const branchFilter = await ExpenditureService.getBranchFilter(user, branchId);

    if (id) {
      const expenditureRecord = await ExpenditureService.getExpenditureRecordById(id, branchFilter);
      if (!expenditureRecord) return NextResponse.json({ error: "Expenditure record not found" }, { status: 404 });
      return successResponse(expenditureRecord);
    }

    const expenditureRecords = await db.expenditureRecord.findMany({
      where: branchFilter,
      include: {
        category: { select: { id: true, name: true, code: true } },
        budgetCategory: { select: { id: true, name: true, code: true, parentId: true } },
        branch: { select: { id: true, name: true, location: true } },
        submittedBy: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
        period: { select: { name: true, startDate: true, endDate: true } },
      },
      orderBy: { recordDate: "desc" },
    });

    return successResponse(expenditureRecords);
  } catch (error) {
    console.error("Error fetching expenditure records:", error);
    return NextResponse.json(
      { error: "Failed to fetch expenditure records" },
      { status: 500 }
    );
  }
}

// POST /api/v1/expenditure - Create new expenditure record
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as AppUser;
    const body = await request.json();

    const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.TELLER, UserRole.BRANCHMANAGER];
    if (!allowedRoles.includes(user.role as UserRole)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const result = await ExpenditureService.createExpenditureRecord(body, user);

    void bumpAccountingSyncState("Expenditure record created");
    return successResponse(result, "Expenditure record created successfully", 201);
  } catch (error: any) {
    console.error("Error creating expenditure record:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create expenditure record" },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/expenditure - Update expenditure record
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as AppUser;
    const body = await request.json();
    const { id, ...data } = body;

    const branchFilter = await ExpenditureService.getBranchFilter(user);
    const existingRecord = await ExpenditureService.getExpenditureRecordById(id, branchFilter);

    if (!existingRecord) {
      return NextResponse.json({ error: "Expenditure record not found" }, { status: 404 });
    }

    if (existingRecord.status !== TransactionStatus.PENDING && user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Only pending expenditures can be updated" }, { status: 403 });
    }

    const updatedRecord = await db.expenditureRecord.update({
      where: { id },
      data: {
        budgetCategoryId: data.categoryId,
        amount: data.amount,
        description: data.description,
        payee: data.payee,
        paymentMethod: data.paymentMethod,
        voucherNo: data.voucherNo,
        status: data.status,
      },
    });

    void bumpAccountingSyncState("Expenditure record updated");
    return successResponse(updatedRecord, "Expenditure record updated successfully");
  } catch (error) {
    console.error("Error updating expenditure record:", error);
    return NextResponse.json({ error: "Failed to update expenditure record" }, { status: 500 });
  }
}

// DELETE /api/v1/expenditure - Delete expenditure record
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as AppUser;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    const branchFilter = await ExpenditureService.getBranchFilter(user);
    const existingRecord = await ExpenditureService.getExpenditureRecordById(id, branchFilter);

    if (!existingRecord) {
      return NextResponse.json({ error: "Expenditure record not found" }, { status: 404 });
    }

    if (existingRecord.status !== TransactionStatus.PENDING && user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Only pending expenditures can be deleted" }, { status: 403 });
    }

    await db.$transaction(async (tx) => {
      await reverseJournalEntriesForRecord(id, user.id, `Expenditure deletion - ${existingRecord.description || id}`, tx, existingRecord.recordDate ?? undefined, existingRecord.branchId ?? undefined);
      await tx.expenditureRecord.delete({ where: { id } });
    });

    void bumpAccountingSyncState("Expenditure record deleted");
    return successResponse(null, "Expenditure record deleted successfully");
  } catch (error) {
    console.error("Error deleting expenditure record:", error);
    return NextResponse.json({ error: "Failed to delete expenditure record" }, { status: 500 });
  }
}
