import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole, TransactionStatus } from "@prisma/client";
import { reverseJournalEntriesForRecord } from "@/lib/journal-entries-extended";

// Helper: Get branch filter
async function getBranchFilter(userRole: string, userBranchId: string | null) {
  if (userRole === UserRole.ADMIN) {
    return {};
  }
  if (!userBranchId) {
    return { branchId: "no-branch-assigned" };
  }
  return { branchId: userBranchId };
}

// GET /api/v1/expenditure/[id] - Get single expenditure record
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params in Next.js 15
    const { id } = await params;

    const user = session.user as any;
    const branchFilter = await getBranchFilter(user.role, user.branchId);

    const expenditureRecord = await db.expenditureRecord.findFirst({
      where: {
        id,
        ...branchFilter,
      },
      include: {
        category: true,
        budgetCategory: true,
        branch: true,
        submittedBy: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
        period: true,
      },
    });

    if (!expenditureRecord) {
      return NextResponse.json(
        { error: "Expenditure record not found or you don't have access to it" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: expenditureRecord });
  } catch (error) {
    console.error("Error fetching expenditure record:", error);
    return NextResponse.json(
      { error: "Failed to fetch expenditure record" },
      { status: 500 }
    );
  }
}

// PUT /api/v1/expenditure/[id] - Update expenditure record
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params in Next.js 15
    const { id } = await params;

    const user = session.user as any;
    const body = await request.json();
    const branchFilter = await getBranchFilter(user.role, user.branchId);

    const existingRecord = await db.expenditureRecord.findFirst({
      where: {
        id,
        ...branchFilter,
      },
    });

    if (!existingRecord) {
      return NextResponse.json(
        { error: "Expenditure record not found or you don't have access to it" },
        { status: 404 }
      );
    }

    // Only allow updates to pending records
    if (existingRecord.status !== TransactionStatus.PENDING) {
      const isAuthorized =
        user.role === UserRole.ADMIN || user.role === UserRole.ACCOUNTANT;

      if (!isAuthorized) {
        return NextResponse.json(
          { error: "Only administrators and accountants can update approved records" },
          { status: 403 }
        );
      }

      if (existingRecord.status === TransactionStatus.COMPLETED) {
        const hoursSinceApproval = existingRecord.approvedAt
          ? (Date.now() - existingRecord.approvedAt.getTime()) / (1000 * 60 * 60)
          : Infinity;

        if (hoursSinceApproval > 24) {
          return NextResponse.json(
            { error: "Can only update approved records within 24 hours of approval" },
            { status: 403 }
          );
        }
      }
    }

    const updateData: any = {};

    if (body.categoryId !== undefined) {
      const category = await db.budgetCategory.findUnique({
        where: { id: body.categoryId },
      });
      if (!category || category.kind !== "EXPENSE") {
        return NextResponse.json(
          { error: "Invalid expense category" },
          { status: 400 }
        );
      }
      updateData.categoryId = body.categoryId;
      updateData.budgetCategoryId = body.categoryId;
    }

    if (body.amount !== undefined) {
      if (body.amount <= 0) {
        return NextResponse.json(
          { error: "Amount must be greater than zero" },
          { status: 400 }
        );
      }
      updateData.amount = body.amount;
    }

    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || undefined;
    }

    if (body.payee !== undefined) {
      updateData.payee = body.payee?.trim() || undefined;
    }

    if (body.paymentMethod !== undefined) {
      updateData.paymentMethod = body.paymentMethod;
    }

    if (body.voucherNo !== undefined) {
      updateData.voucherNo = body.voucherNo?.trim() || undefined;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    const updatedRecord = await db.expenditureRecord.update({
      where: { id },
      data: updateData,
      include: {
        budgetCategory: true,
        branch: true,
        submittedBy: {
          select: {
            name: true,
            role: true,
          },
        },
        approvedBy: {
          select: {
            name: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: updatedRecord,
      message: "Expenditure record updated successfully",
    });
  } catch (error) {
    console.error("Error updating expenditure record:", error);
    return NextResponse.json(
      { error: "Failed to update expenditure record" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/expenditure/[id] - Delete expenditure record
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params in Next.js 15
    const { id } = await params;

    const user = session.user as any;
    const branchFilter = await getBranchFilter(user.role, user.branchId);

    const existingRecord = await db.expenditureRecord.findFirst({
      where: {
        id,
        ...branchFilter,
      },
    });

    if (!existingRecord) {
      return NextResponse.json(
        { error: "Expenditure record not found or you don't have access to it" },
        { status: 404 }
      );
    }

    // Only allow deletion of pending records
    if (existingRecord.status !== TransactionStatus.PENDING) {
      return NextResponse.json(
        { error: "Can only delete pending expenditure records" },
        { status: 403 }
      );
    }

    await db.$transaction(async (tx) => {
      await reverseJournalEntriesForRecord(id, user.id, `Expenditure deletion - ${existingRecord.description || id}`, tx, existingRecord.recordDate ?? undefined, existingRecord.branchId ?? undefined);
      await tx.expenditureRecord.delete({ where: { id } });
    });

    return NextResponse.json({
      message: "Expenditure record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting expenditure record:", error);
    return NextResponse.json(
      { error: "Failed to delete expenditure record" },
      { status: 500 }
    );
  }
}
