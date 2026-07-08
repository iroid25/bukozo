import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { successResponse, ApiErrors } from "@/lib/api-utils";
import { UserRole } from "@prisma/client";

// GET /api/v1/members/{memberId} - Get member details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    const { memberId } = await params;

    const member = await db.member.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            dateOfBirth: true,
            image: true,
          },
        },
        accounts: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            accountNumber: true,
            balance: true,
            status: true,
            customFlatWithdrawalFee: true,
            customWithdrawalFeePercentage: true,
            customWithdrawalFeeTiers: true,
            accountType: {
              select: {
                id: true,
                name: true,
                interestRate: true,
                minBalance: true,
                flatWithdrawalFee: true,
                withdrawalFeePercentage: true,
                withdrawalFeeTiers: true,
                isShareAccount: true,
                canWithdraw: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
        shareAccounts: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            accountNumber: true,
            accountTypeId: true,
            numberOfShares: true,
            shareValue: true,
            totalValue: true,
            status: true,
            accountType: {
              select: {
                id: true,
                name: true,
                sharePrice: true,
                isShareAccount: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      return ApiErrors.notFound("Member");
    }

    return successResponse(member);
  } catch (error: any) {
    console.error("Error fetching member:", error);
    return ApiErrors.internalError(error.message);
  }
}

// PUT /api/v1/members/{memberId} - Update member details
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized();

    const { memberId } = await params;
    const data = await request.json();

    const existing = await db.member.findUnique({ where: { id: memberId }, include: { user: true } });
    if (!existing) return ApiErrors.notFound("Member");

    // Build update data from provided fields
    const updateData: Record<string, any> = {};
    const memberFields = [
      "surname","otherNames","age","gender","maritalStatus","maritalOther",
      "nokName","nokRelationship","nokPhone","numberOfChildren","numberOfDependants","fatherName","motherName",
      "levelOfEducation","citizenship","occupation","otherFinancialInstitutions",
      "village","parish","subCounty","constituency","town","district","postalAddress",
      "nin","typeOfId","passportPhoto","idCopyPath",
      "certifiedBy","certifierAccountNo","certifierPhone","certificationDate","withdrawalInstructions",
      "applicantOccupationLC","designationLC","locationLC","otherSaccosCount","financialDiscipline",
      "recommenderName","recommenderTitle","recommenderPhone","recommendationDate",
      "entryFee","initialSavings","nominee",
      "approvalDate","rejectionReason","savingsAccountNumber",
    ];
    for (const field of memberFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    const updatedMember = await db.member.update({
      where: { id: memberId },
      data: updateData,
      include: { user: { select: { id: true, firstName: true, lastName: true, name: true, email: true, phone: true, dateOfBirth: true, nationalId: true, role: true, isActive: true } } },
    });

    // Update user fields if provided
    if (data.firstName || data.lastName || data.phone || data.address || data.dateOfBirth) {
      await db.user.update({
        where: { id: existing.userId },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          address: data.address,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        },
      });
    }

    await db.auditLog.create({
      data: {
        userId: (session.user as any).id,
        action: "MEMBER_UPDATED",
        entityType: "Member",
        entityId: memberId,
        details: `Updated member: ${existing.user?.name}`,
      },
    });

    return successResponse(updatedMember);
  } catch (error: any) {
    console.error("Error updating member:", error);
    return ApiErrors.internalError(error.message);
  }
}
