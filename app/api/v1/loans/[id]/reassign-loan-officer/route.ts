import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

const schema = z.object({
  loanOfficerId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "BRANCHMANAGER", "LOANOFFICER"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await props.params;
    const body = schema.parse(await request.json());

    const loan = await db.loan.findUnique({
      where: { id },
      select: {
        id: true,
        branchId: true,
        status: true,
        loanApplication: {
          select: {
            id: true,
            loanOfficerId: true,
          },
        },
      },
    });

    if (!loan) {
      return NextResponse.json({ success: false, error: "Loan not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && user.branchId && loan.branchId && user.branchId !== loan.branchId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (user.role === "LOANOFFICER" && loan.loanApplication.loanOfficerId !== user.id) {
      return NextResponse.json(
        { success: false, error: "You can only reassign loans assigned to you" },
        { status: 403 },
      );
    }

    const targetOfficer = await db.user.findUnique({
      where: { id: body.loanOfficerId },
      select: {
        id: true,
        name: true,
        role: true,
        branchId: true,
      },
    });

    if (!targetOfficer || !["LOANOFFICER", "BRANCHMANAGER", "ADMIN"].includes(targetOfficer.role)) {
      return NextResponse.json({ success: false, error: "Selected user is not a valid loan officer" }, { status: 400 });
    }

    if (user.role !== "ADMIN" && user.branchId && targetOfficer.branchId && user.branchId !== targetOfficer.branchId) {
      return NextResponse.json({ success: false, error: "You can only assign officers within your branch" }, { status: 403 });
    }

    const updated = await db.loanApplication.update({
      where: { id: loan.loanApplication.id },
      data: {
        loanOfficerId: body.loanOfficerId,
      },
      include: {
        loanProduct: true,
        loanOfficer: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "LOAN_OFFICER_REASSIGNED",
        entityType: "LoanApplication",
        entityId: loan.loanApplication.id,
        oldValue: { loanOfficerId: loan.loanApplication.loanOfficerId },
        newValue: { loanOfficerId: body.loanOfficerId },
        details: `Loan officer reassigned to ${targetOfficer.name}`,
        timestamp: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error reassigning loan officer:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reassign loan officer",
      },
      { status: 500 },
    );
  }
}
