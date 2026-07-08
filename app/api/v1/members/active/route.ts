import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";

/**
 * GET /api/v1/members/active
 * Fetches active members with their accounts, optionally filtered by branch.
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
        { memberNumber: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { phone: { contains: search, mode: "insensitive" } } },
      ],
      accounts: {
        some: {
          status: "ACTIVE",
          ...(userRole !== UserRole.ADMIN && { branchId: userBranchId }),
        },
      },
    };

    const members = await db.member.findMany({
      where: whereClause,
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
        fingerprintTemplate: true,
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
        user: { name: "asc" },
      },
      take: 50,
    });

    return NextResponse.json({ success: true, data: members });
  } catch (error: any) {
    console.error("Error fetching active members API:", error);
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
