import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { successResponse, errorResponse, ApiErrors, getPaginationParams, createPaginationMeta } from "@/lib/api-utils";

// GET /api/v1/accounts/{accountId} - Get account details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    const { accountId } = await params;

    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        accountType: {
          select: {
            name: true,
            interestRate: true,
            minBalance: true,
            maxWithdrawal: true,
            isLoanEligible: true,
          },
        },
        member: {
          select: {
            memberNumber: true,
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        institution: {
          select: {
            institutionNumber: true,
            institutionName: true,
          },
        },
        branch: {
          select: {
            name: true,
            location: true,
          },
        },
      },
    });

    if (!account) {
      return ApiErrors.notFound("Account");
    }

    return successResponse(account);
  } catch (error: any) {
    console.error("Error fetching account:", error);
    return ApiErrors.internalError(error.message);
  }
}
