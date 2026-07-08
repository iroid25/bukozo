import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";

/**
 * GET /api/v1/institutions/active
 * Fetches active institutions with accounts and signatories, filtered by branch security.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const userRole = (session.user as any).role;
    const userBranchId = (session.user as any).branchId;

    const whereClause: any = {
      isApproved: true,
      OR: [
        { institutionNumber: { contains: search, mode: "insensitive" } },
        { institutionName: { contains: search, mode: "insensitive" } },
        { institutionEmail: { contains: search, mode: "insensitive" } },
        { institutionPhone: { contains: search, mode: "insensitive" } },
      ],
    };

    const institutions = await db.institution.findMany({
      where: whereClause,
      select: {
        id: true,
        institutionNumber: true,
        institutionName: true,
        institutionType: true,
        institutionEmail: true,
        institutionPhone: true,
        withdrawalMandate: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
          },
        },
        signatories: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            title: true,
            phone: true,
            isPrimary: true,
            signatureImage: true,
          },
        },
        accounts: {
          where: {
            status: "ACTIVE",
            ...(userRole !== UserRole.ADMIN && { branchId: userBranchId }),
          },
          select: {
            id: true,
            accountNumber: true,
            balance: true,
            customFlatWithdrawalFee: true,
            customWithdrawalFeePercentage: true,
            customWithdrawalFeeTiers: true,
            accountType: {
              select: {
                id: true,
                name: true,
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
      },
      orderBy: {
        institutionName: "asc",
      },
      take: 50,
    });

    return NextResponse.json({ success: true, data: institutions });
  } catch (error: any) {
    console.error("Error fetching active institutions API:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 },
    );
  }
}
