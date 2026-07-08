import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";

// GET /api/v1/institutions/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const currentUser = session.user as any;

    const institution = await db.institution.findUnique({
      where: { id },
      include: {
        user: { include: { branch: true } },
        accounts: { include: { accountType: true } },
      },
    });

    if (!institution) return NextResponse.json({ error: "Institution not found" }, { status: 404 });

    if (currentUser.role !== UserRole.ADMIN && institution.user.branchId !== currentUser.branchId) {
      return NextResponse.json({ error: "You don't have permission to view this institution" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: institution });
  } catch (error) {
    console.error("Error fetching institution:", error);
    return NextResponse.json({ error: "Failed to fetch institution" }, { status: 500 });
  }
}

// PUT /api/v1/institutions/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const currentUser = session.user as any;
    const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.BRANCHMANAGER, UserRole.ACCOUNTANT, UserRole.DATA_ENTRANT];
    if (!allowedRoles.includes(currentUser.role as UserRole)) {
      return NextResponse.json({ error: "You don't have permission to update institutions" }, { status: 403 });
    }

    const { id } = await params;
    const data = await request.json();

    const existingInstitution = await db.institution.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existingInstitution) return NextResponse.json({ error: "Institution not found" }, { status: 404 });

    if (currentUser.role !== UserRole.ADMIN && existingInstitution.user.branchId !== currentUser.branchId) {
      return NextResponse.json({ error: "You can only update institutions in your branch" }, { status: 403 });
    }

    const finalBranchId = currentUser.role === UserRole.ADMIN ? data.branchId : existingInstitution.user.branchId;

    const updatedUser = await db.user.update({
      where: { id: existingInstitution.userId },
      data: {
        name: data.institutionName || existingInstitution.institutionName,
        phone: data.phone,
        address: data.address,
        branchId: finalBranchId,
        isActive: data.isActive ?? existingInstitution.user.isActive,
      },
    });

    const updatedInstitution = await db.$transaction(async (tx) => {
      const inst = await tx.institution.update({
        where: { id },
        data: {
          institutionName: data.institutionName ?? existingInstitution.institutionName,
          institutionEmail: data.institutionEmail ?? existingInstitution.institutionEmail,
          institutionPhone: data.institutionPhone ?? existingInstitution.institutionPhone,
          street: data.street ?? existingInstitution.street,
          postalAddress: data.postalAddress ?? existingInstitution.postalAddress,
          district: data.district ?? existingInstitution.district,
          subCounty: data.subCounty ?? existingInstitution.subCounty,
          village: data.village ?? existingInstitution.village,
          parish: data.parish ?? existingInstitution.parish,
          constituency: data.constituency ?? existingInstitution.constituency,
          town: data.town ?? existingInstitution.town,
          bankName: data.bankName ?? existingInstitution.bankName,
          bankAccountNumber: data.bankAccountNumber ?? existingInstitution.bankAccountNumber,
          accountTitle: data.accountTitle ?? existingInstitution.accountTitle,
          accountType: data.accountType ?? existingInstitution.accountType,
          operatingInstructions: data.operatingInstructions ?? existingInstitution.operatingInstructions,
          signatoryChangeRules: data.signatoryChangeRules ?? existingInstitution.signatoryChangeRules,
          administrators: data.administrators
            ? data.administrators.filter((a: any) => a.name && a.post)
            : existingInstitution.administrators,
        },
      });

      // Update signatories when administrators are provided
      if (Array.isArray(data.administrators)) {
        const validAdmins = data.administrators.filter((a: any) => a.name && a.post);
        await tx.institutionSignatory.deleteMany({ where: { institutionId: id } });
        if (validAdmins.length > 0) {
          for (const admin of validAdmins) {
            await tx.institutionSignatory.create({
              data: {
                institutionId: id,
                name: admin.name,
                title: admin.post,
                phone: admin.phone || null,
                email: admin.email || null,
                signatureImage: admin.signature || admin.photo || null,
                isPrimary: false,
              },
            });
          }
        }
      }

      return inst;
    });

    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "INSTITUTION_UPDATED",
        entityType: "Institution",
        entityId: id,
        details: `Updated institution: ${updatedInstitution.institutionName}`,
      },
    });

    return NextResponse.json({ success: true, data: updatedInstitution });
  } catch (error) {
    console.error("Error updating institution:", error);
    return NextResponse.json({ error: "Failed to update institution" }, { status: 500 });
  }
}

// DELETE /api/v1/institutions/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const currentUser = session.user as any;
    if (!["ADMIN", "BRANCHMANAGER"].includes(currentUser.role)) {
      return NextResponse.json({ error: "You don't have permission to delete institutions" }, { status: 403 });
    }

    const { id } = await params;
    const institution = await db.institution.findUnique({ where: { id }, include: { user: true } });
    if (!institution) return NextResponse.json({ error: "Institution not found" }, { status: 404 });

    if (currentUser.role !== "ADMIN" && institution.user.branchId !== currentUser.branchId) {
      return NextResponse.json({ error: "You can only delete institutions in your branch" }, { status: 403 });
    }

    await db.user.update({ where: { id: institution.userId }, data: { isActive: false } });

    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "INSTITUTION_DELETED",
        entityType: "Institution",
        entityId: id,
        details: `Deleted institution: ${institution.institutionName}`,
      },
    });

    return NextResponse.json({ success: true, message: "Institution deleted successfully" });
  } catch (error) {
    console.error("Error deleting institution:", error);
    return NextResponse.json({ error: "Failed to delete institution" }, { status: 500 });
  }
}
