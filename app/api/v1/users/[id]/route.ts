// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import {
  compareAuditTrailRows,
  recordCustomerAuditTrail,
} from "@/lib/customer-audit-trail";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthUser();
    const { id } = await params;

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    if (currentUser.role !== "ADMIN" && currentUser.role !== "BRANCHMANAGER") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate email uniqueness if changed
    if (body.email) {
      const existingUser = await db.user.findFirst({
        where: {
          email: body.email,
          NOT: { id },
        },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 400 }
        );
      }
    }

    // Validate phone uniqueness if changed
    if (body.phone) {
      const existingUser = await db.user.findFirst({
        where: {
          phone: body.phone,
          NOT: { id },
        },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "Phone number already in use" },
          { status: 400 }
        );
      }
    }

    // Validate national ID uniqueness if changed
    if (body.nationalId) {
      const existingUser = await db.user.findFirst({
        where: {
          nationalId: body.nationalId,
          NOT: { id },
        },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "National ID already in use" },
          { status: 400 }
        );
      }
    }

    const existingUser = await db.user.findUnique({
      where: { id },
      include: {
        member: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update user
    const updatedUser = await db.user.update({
      where: { id },
      data: {
        name: body.name,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        address: body.address,
        nationalId: body.nationalId,
        jobTitle: body.jobTitle,
        areaOfOperation: body.areaOfOperation,
        image: body.image,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        role: currentUser.role === "ADMIN" && body.role ? body.role : undefined,
        branchId: body.branchId || null,
        isActive: body.isActive,
      },
      include: {
        branch: true,
        member: true,
      },
    });

    // Log the update
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "USER_UPDATED",
        entityType: "USER",
        entityId: id,
        newValue: {
          name: body.name,
          email: body.email,
          role: body.role,
          isActive: body.isActive,
        },
        details: `Updated user: ${updatedUser.name}`,
      },
    });

    if (updatedUser.member) {
      try {
        const branch = currentUser.branchId
          ? await db.branch.findUnique({
              where: { id: currentUser.branchId },
              select: { id: true, name: true },
            })
          : null;

        const beforeSnapshot = {
          member: {
            id: existingUser.member?.id || updatedUser.member.id,
            memberNumber:
              existingUser.member?.memberNumber || updatedUser.member.memberNumber,
            registrationDate:
              existingUser.member?.registrationDate || updatedUser.member.registrationDate,
            gender: existingUser.member?.gender || updatedUser.member.gender,
            nin: existingUser.member?.nin || updatedUser.member.nin,
            village: existingUser.member?.village || updatedUser.member.village,
            parish: existingUser.member?.parish || updatedUser.member.parish,
            subCounty: existingUser.member?.subCounty || updatedUser.member.subCounty,
            constituency:
              existingUser.member?.constituency || updatedUser.member.constituency,
            town: existingUser.member?.town || updatedUser.member.town,
            district: existingUser.member?.district || updatedUser.member.district,
            otherNames:
              existingUser.member?.otherNames || updatedUser.member.otherNames,
          },
          user: {
            id: existingUser.id,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            name: existingUser.name,
            email: existingUser.email,
            phone: existingUser.phone,
            dateOfBirth: existingUser.dateOfBirth,
            address: existingUser.address,
            nationalId: existingUser.nationalId,
            branchId: existingUser.branchId,
          },
        };

        const afterSnapshot = {
          member: {
            id: updatedUser.member.id,
            memberNumber: updatedUser.member.memberNumber,
            registrationDate: updatedUser.member.registrationDate,
            gender: updatedUser.member.gender,
            nin: updatedUser.member.nin,
            village: updatedUser.member.village,
            parish: updatedUser.member.parish,
            subCounty: updatedUser.member.subCounty,
            constituency: updatedUser.member.constituency,
            town: updatedUser.member.town,
            district: updatedUser.member.district,
            otherNames: updatedUser.member.otherNames,
          },
          user: {
            id: updatedUser.id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            dateOfBirth: updatedUser.dateOfBirth,
            address: updatedUser.address,
            nationalId: updatedUser.nationalId,
            branchId: updatedUser.branchId,
          },
        };

        const changedFields = compareAuditTrailRows(
          beforeSnapshot as any,
          afterSnapshot as any,
        );
        if (changedFields.length > 0) {
          await recordCustomerAuditTrail({
            actionType: "Edited",
            customerId: updatedUser.member.id,
            before: beforeSnapshot as any,
            after: afterSnapshot as any,
            changedBy: currentUser.name,
            changedByUserId: currentUser.id,
            branch,
          });
        }
      } catch (trailError) {
        console.error("Error recording customer audit trail:", trailError);
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedUser,
    });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthUser();
    const { id } = await params;

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id },
      include: {
        branch: true,
        member: true,
        userFloat: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch user" },
      { status: 500 }
    );
  }
}
