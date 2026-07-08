import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { successResponse, ApiErrors } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized();

    const { id } = await params;

    const deposit = await db.deposit.findUnique({
      where: { id },
      select: {
        id: true,
        transactionId: true,
        memberId: true,
        institutionId: true,
        accountId: true,
        amount: true,
        channel: true,
        mobileMoneyRef: true,
        depositorName: true,
        depositDate: true,
        handlerUserId: true,
        transaction: {
          select: {
            id: true,
            transactionRef: true,
            type: true,
            amount: true,
            status: true,
            description: true,
            currency: true,
            branchId: true,
            notes: true,
          },
        },
        member: {
          select: {
            id: true,
            memberNumber: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        institution: {
          select: {
            id: true,
            institutionNumber: true,
            institutionName: true,
            institutionType: true,
            institutionEmail: true,
            institutionPhone: true,
            primaryContactPerson: true,
            primaryContactPhone: true,
            primaryContactEmail: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        account: {
          select: {
            id: true,
            accountNumber: true,
            balance: true,
            accountType: {
              select: {
                id: true,
                name: true,
                minBalance: true,
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
        handler: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!deposit) return ApiErrors.notFound("Deposit");

    return successResponse(deposit);
  } catch (error: any) {
    console.error("Error fetching deposit:", error);
    return ApiErrors.internalError(error.message);
  }
}
