import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole, PaymentMethod, TransactionStatus, Prisma } from "@prisma/client";
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
const BLOCKED_INCOME_CATEGORY_NAMES = ["loan insurance fees", "loan share capital"];

// GET /api/v1/income/[id] - Get single income record
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

    const incomeRecord = await db.incomeRecord.findFirst({
      where: {
        id,
        ...branchFilter,
        budgetCategory: {
          kind: "INCOME",
          name: {
            notIn: BLOCKED_INCOME_CATEGORY_NAMES,
            mode: "insensitive",
          },
        },
      },
      include: {
        budgetCategory: {
          include: {
            parent: true,
          },
        },
        branch: true,
        member: {
          include: {
            user: true,
          },
        },
        account: {
          include: {
            accountType: true,
          },
        },
        receivedBy: {
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

    if (!incomeRecord) {
      return NextResponse.json(
        { error: "Income record not found or you don't have access to it" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: incomeRecord });
  } catch (error) {
    console.error("Error fetching income record:", error);
    return NextResponse.json(
      { error: "Failed to fetch income record" },
      { status: 500 }
    );
  }
}

// PUT /api/v1/income/[id] - Update income record
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

    const existingRecord = await db.incomeRecord.findFirst({
      where: {
        id,
        ...branchFilter,
        budgetCategory: {
          kind: "INCOME",
          name: {
            notIn: BLOCKED_INCOME_CATEGORY_NAMES,
            mode: "insensitive",
          },
        },
      },
    });

    if (!existingRecord) {
      return NextResponse.json(
        { error: "Income record not found or you don't have access to it" },
        { status: 404 }
      );
    }

    // Only allow updates within 24 hours or if user is authorized
    const isAuthorized =
      user.role === UserRole.ADMIN || user.role === UserRole.ACCOUNTANT;

    if (!isAuthorized) {
      const hoursSinceRecord =
        (Date.now() - existingRecord.recordDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceRecord > 24) {
        return NextResponse.json(
          { error: "Can only update records within 24 hours of creation" },
          { status: 403 }
        );
      }
    }

    const updateData: any = {};

    if (body.categoryId !== undefined) {
      const category = await db.budgetCategory.findUnique({
        where: { id: body.categoryId },
      });
      if (!category || category.kind !== "INCOME") {
        return NextResponse.json(
          { error: "Invalid income category" },
          { status: 400 }
        );
      }
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

    if (body.paymentMethod !== undefined) {
      updateData.paymentMethod = body.paymentMethod;
    }

    if (body.receiptNo !== undefined) {
      updateData.receiptNo = body.receiptNo?.trim() || undefined;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    if (body.depositorName !== undefined) {
      updateData.depositorName = body.depositorName?.trim() || undefined;
    }

    if (body.depositorContact !== undefined) {
      updateData.depositorContact = body.depositorContact?.trim() || undefined;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes?.trim() || undefined;
    }

    const updatedRecord = await db.incomeRecord.update({
      where: { id },
      data: updateData,
      include: {
        budgetCategory: { include: { parent: true } },
        branch: true,
        member: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        receivedBy: {
          select: {
            name: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: updatedRecord,
      message: "Income record updated successfully",
    });
  } catch (error) {
    console.error("Error updating income record:", error);
    return NextResponse.json(
      { error: "Failed to update income record" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/income/[id] - Delete income record
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

    const existingRecord = await db.incomeRecord.findFirst({
      where: {
        id,
        ...branchFilter,
        budgetCategory: {
          kind: "INCOME",
          name: {
            notIn: BLOCKED_INCOME_CATEGORY_NAMES,
            mode: "insensitive",
          },
        },
      },
    });

    if (!existingRecord) {
      return NextResponse.json(
        { error: "Income record not found or you don't have access to it" },
        { status: 404 }
      );
    }

    // Only ADMIN can delete, or within 24 hours for others
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isAdmin) {
      const hoursSinceRecord =
        (Date.now() - existingRecord.recordDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceRecord > 24) {
        return NextResponse.json(
          { error: "Can only delete records within 24 hours of creation" },
          { status: 403 }
        );
      }
    }

    await db.$transaction(async (tx) => {
      await reverseJournalEntriesForRecord(id, user.id, `Income deletion - ${existingRecord.description || existingRecord.id}`, tx, existingRecord.recordDate ?? undefined, existingRecord.branchId ?? undefined);
      await tx.incomeRecord.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      message: "Income record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting income record:", error);
    return NextResponse.json(
      { error: "Failed to delete income record" },
      { status: 500 }
    );
  }
}
