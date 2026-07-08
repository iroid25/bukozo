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

    const withdrawal = await db.withdrawal.findUnique({
      where: { id },
      include: {
        transaction: true,
        member: {
          include: {
            user: true,
          },
        },
        institution: {
          include: {
            user: true,
            signatories: true,
          },
        },
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
        handler: true,
      },
    });

    if (!withdrawal) return ApiErrors.notFound("Withdrawal");

    return successResponse(withdrawal);
  } catch (error: any) {
    console.error("Error fetching withdrawal:", error);
    return ApiErrors.internalError(error.message);
  }
}
