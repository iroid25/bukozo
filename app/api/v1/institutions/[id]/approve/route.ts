import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const allowedRoles = [UserRole.ADMIN, UserRole.BRANCHMANAGER] as const;
    if (!allowedRoles.includes(user.role as (typeof allowedRoles)[number])) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to approve institutions" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await db.institution.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            branchId: true,
            branch: { select: { name: true } },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Institution not found" },
        { status: 404 }
      );
    }

    if (existing.isApproved) {
      return NextResponse.json(
        { success: false, error: "Institution is already approved" },
        { status: 400 }
      );
    }

    if (user.role !== UserRole.ADMIN && existing.user.branchId !== user.branchId) {
      return NextResponse.json(
        { success: false, error: "You can only approve institutions in your branch" },
        { status: 403 }
      );
    }

    const approvedInstitution = await db.institution.update({
      where: { id },
      data: { isApproved: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            branchId: true,
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    await db.user.update({
      where: { id: approvedInstitution.userId },
      data: {
        isActive: true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "INSTITUTION_APPROVED",
        entityType: "Institution",
        entityId: id,
        newValue: {
          institutionNumber: approvedInstitution.institutionNumber,
          institutionName: approvedInstitution.institutionName,
          branchId: approvedInstitution.user.branchId,
        },
        details: `Approved institution: ${approvedInstitution.institutionName}`,
      },
    });

    return NextResponse.json({
      success: true,
      data: approvedInstitution,
    });
  } catch (error) {
    console.error("Error approving institution via API:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to approve institution",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
